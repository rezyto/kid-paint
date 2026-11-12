package pt.pintacomigo.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.view.WindowManager;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/assets/index.html";
    private static final int REQ_FILE = 41;
    private static final int REQ_STORAGE = 42;

    private static final long CHECK_EVERY_MS = 2L * 60 * 1000;      // ao voltar à app, verifica no máximo de 2 em 2 minutos
    private static final long APK_ASK_EVERY_MS = 24L * 60 * 60 * 1000;

    private WebView web;
    private View splash;
    private boolean pageStarted = false;
    private boolean checking = false;
    private final Handler ui = new Handler(Looper.getMainLooper());
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebUpdater.PathHandler(this))
                .build();

        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        web = new WebView(this);
        web.setBackgroundColor(0xFFFFF7E8);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE); // os ficheiros da app vêm sempre da versão instalada

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (splash != null) splash.setVisibility(View.GONE);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Segurança para crianças: a app nunca abre páginas da internet.
                return !HOST.equals(request.getUrl().getHost());
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                return openPicker(params != null && params.isCaptureEnabled());
            }
        });

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");

        FrameLayout root = new FrameLayout(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        splash = buildSplash();
        root.addView(splash, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        hideSystemBars();

        startWithLatest();
    }

    /* Ao abrir: aplica o que já foi descarregado, procura novidades (no máximo ~6 s) e só depois mostra a app. */
    private void startWithLatest() {
        WebUpdater.cleanupIfApkNewer(this);
        WebUpdater.applyPending(this);
        final boolean[] done = {false};
        final Runnable go = () -> {
            if (done[0]) return;
            done[0] = true;
            pageStarted = true;
            web.loadUrl(START_URL);
        };
        ui.postDelayed(go, 6000); // sem internet lenta a prender a criança
        checking = true;
        new Thread(() -> {
            WebUpdater.Result r = WebUpdater.check(this);
            ui.post(() -> {
                checking = false;
                if (!done[0]) {
                    WebUpdater.applyPending(this); // ainda não carregou nada: entra já na versão nova
                    go.run();
                }
                maybeAskApk(r);
            });
        }).start();
    }

    /* Ao voltar à app (sem a fechar): se houver novidades, descarrega e recarrega já com elas. */
    private void checkOnResume() {
        if (checking || !pageStarted || !WebUpdater.dueForCheck(this, CHECK_EVERY_MS)) return;
        checking = true;
        new Thread(() -> {
            WebUpdater.Result r = WebUpdater.check(this);
            ui.post(() -> {
                checking = false;
                if (r.webUpdated) applyAndReload();
                maybeAskApk(r);
            });
        }).start();
    }

    private void applyAndReload() {
        if (web == null) return;
        // guarda o desenho, troca os ficheiros e recarrega (a app volta ao desenho em que estava)
        web.evaluateJavascript("(window.__saveNow && window.__saveNow(), true)", v -> ui.postDelayed(() -> {
            if (WebUpdater.applyPending(this) && web != null) {
                if (splash != null) splash.setVisibility(View.VISIBLE);
                web.reload();
            }
        }, 700));
    }

    private void maybeAskApk(WebUpdater.Result r) {
        if (r == null || r.apkUrl == null || isFinishing()) return;
        android.content.SharedPreferences p = getSharedPreferences("updater", MODE_PRIVATE);
        if (System.currentTimeMillis() - p.getLong("asked", 0) < APK_ASK_EVERY_MS) return;
        p.edit().putLong("asked", System.currentTimeMillis()).apply();
        Updater.ask(this, r.apkUrl, "1." + r.remoteVersion);
    }

    private View buildSplash() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setBackgroundColor(0xFFF7F5F2);
        box.setClickable(true);
        float d = getResources().getDisplayMetrics().density;
        ImageView icon = new ImageView(this);
        icon.setImageResource(R.mipmap.ic_launcher);
        box.addView(icon, new LinearLayout.LayoutParams((int) (96 * d), (int) (96 * d)));
        TextView t = new TextView(this);
        t.setText("Pinta Comigo");
        t.setTextSize(22);
        t.setTextColor(0xFF1F1B2D);
        t.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
        t.setPadding(0, (int) (16 * d), 0, (int) (18 * d));
        box.addView(t);
        ProgressBar pb = new ProgressBar(this);
        pb.setIndeterminate(true);
        box.addView(pb, new LinearLayout.LayoutParams((int) (32 * d), (int) (32 * d)));
        return box;
    }

    /* ---------- fotos: câmara ou galeria ---------- */
    private boolean openPicker(boolean cameraOnly) {
        Intent camera = null;
        try {
            File dir = new File(getCacheDir(), "photos");
            if (!dir.exists()) dir.mkdirs();
            File f = new File(dir, "foto_" + System.currentTimeMillis() + ".jpg");
            cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
            camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
            camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } catch (Exception e) {
            cameraUri = null;
        }

        Intent target;
        if (cameraOnly && camera != null) {
            target = camera;
        } else {
            Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            pick.setType("image/*");
            target = Intent.createChooser(pick, "Escolher foto");
            if (camera != null) target.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
        }
        try {
            startActivityForResult(target, REQ_FILE);
            return true;
        } catch (Exception e) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = null;
            Toast.makeText(this, "Não foi possível abrir as fotos", Toast.LENGTH_SHORT).show();
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            } else if (cameraUri != null) {
                result = new Uri[]{cameraUri};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    /* ---------- ponte JavaScript <-> Android ---------- */
    private class Bridge {
        @JavascriptInterface
        public String getVersion() {
            return "1." + WebUpdater.currentVersion(MainActivity.this);
        }

        @JavascriptInterface
        public void checkUpdate(final boolean manual) {
            new Thread(() -> {
                WebUpdater.Result r = WebUpdater.check(MainActivity.this);
                ui.post(() -> {
                    if (r.webUpdated) {
                        Toast.makeText(MainActivity.this, "Nova versão instalada ✓", Toast.LENGTH_SHORT).show();
                        applyAndReload();
                    } else if (r.apkUrl != null) {
                        Updater.ask(MainActivity.this, r.apkUrl, "1." + r.remoteVersion);
                    } else if (manual) {
                        Toast.makeText(MainActivity.this, r.remoteVersion < 0 ? "Sem internet. Tenta mais tarde." : "A app já está atualizada ✓", Toast.LENGTH_SHORT).show();
                    }
                });
            }).start();
        }

        @JavascriptInterface
        public void keepAwake(final boolean on) {
            runOnUiThread(() -> {
                if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            });
        }

        @JavascriptInterface
        public void shareImage(String base64, String fileName) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                File dir = new File(getCacheDir(), "share");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, fileName);
                try (FileOutputStream fos = new FileOutputStream(f)) {
                    fos.write(bytes);
                }
                Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", f);
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("image/png");
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                final Intent chooser = Intent.createChooser(send, "Partilhar desenho");
                runOnUiThread(() -> {
                    try {
                        startActivity(chooser);
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Não foi possível partilhar", Toast.LENGTH_SHORT).show();
                    }
                });
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Não foi possível partilhar", Toast.LENGTH_SHORT).show());
            }
        }

        @JavascriptInterface
        public boolean saveText(String text, String fileName) {
            try {
                byte[] bytes = text.getBytes("UTF-8");
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                    v.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/PintaComigo");
                    ContentResolver cr = getContentResolver();
                    Uri uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) return false;
                    try (OutputStream os = cr.openOutputStream(uri)) {
                        if (os == null) return false;
                        os.write(bytes);
                    }
                    return true;
                } else {
                    if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                        runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE));
                        return false;
                    }
                    File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "PintaComigo");
                    if (!dir.exists()) dir.mkdirs();
                    try (FileOutputStream fos = new FileOutputStream(new File(dir, fileName))) {
                        fos.write(bytes);
                    }
                    return true;
                }
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public boolean saveImage(String base64, String fileName) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                    v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                    v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/PintaComigo");
                    ContentResolver cr = getContentResolver();
                    Uri uri = cr.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) return false;
                    try (OutputStream os = cr.openOutputStream(uri)) {
                        if (os == null) return false;
                        os.write(bytes);
                    }
                    return true;
                } else {
                    if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                        runOnUiThread(() -> requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE));
                        return false;
                    }
                    File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "PintaComigo");
                    if (!dir.exists()) dir.mkdirs();
                    File f = new File(dir, fileName);
                    try (FileOutputStream fos = new FileOutputStream(f)) {
                        fos.write(bytes);
                    }
                    MediaScannerConnection.scanFile(MainActivity.this, new String[]{f.getAbsolutePath()}, new String[]{"image/png"}, null);
                    return true;
                }
            } catch (Exception e) {
                return false;
            }
        }
    }

    /* ---------- guardar sempre ---------- */
    private void saveNow() {
        if (web != null) web.evaluateJavascript("window.__saveNow && window.__saveNow()", null);
    }

    @Override
    protected void onPause() {
        saveNow();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        checkOnResume();
    }

    @Override
    protected void onStop() {
        saveNow();
        super.onStop();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web == null) {
            super.onBackPressed();
            return;
        }
        web.evaluateJavascript("(window.__onBack ? window.__onBack() : false)", value -> {
            if (!"true".equals(value)) {
                saveNow();
                moveTaskToBack(true);
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN);
        }
    }
}

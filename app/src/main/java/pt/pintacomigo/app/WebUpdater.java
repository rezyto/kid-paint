package pt.pintacomigo.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.WebResourceResponse;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Atualização silenciosa do conteúdo da app (ecrãs, desenhos, ferramentas).
 * Descarrega "web.zip" do último Release do GitHub e passa a servir esses ficheiros
 * em vez dos que vieram dentro do APK. Não precisa de instalar nada nem de perguntar.
 * Os desenhos não são tocados: ficam na base de dados da app, na mesma origem.
 */
final class WebUpdater {

    static final class Result {
        boolean webUpdated;   // novos ficheiros prontos (ou já aplicados)
        String apkUrl;        // só preenchido se a parte nativa mudou (precisa de instalar APK)
        int remoteVersion = -1;
    }

    private static final String PREFS = "webupdater";

    private WebUpdater() {
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static File liveDir(Context c) {
        return new File(c.getFilesDir(), "web");
    }

    private static File pendingDir(Context c) {
        return new File(c.getFilesDir(), "web_pending");
    }

    /** Versão do conteúdo que está a ser mostrado. */
    static int currentVersion(Context c) {
        int v = prefs(c).getInt("live", 0);
        return Math.max(v, BuildConfig.VERSION_CODE);
    }

    private static boolean liveActive(Context c) {
        int v = prefs(c).getInt("live", 0);
        return v > BuildConfig.VERSION_CODE && new File(liveDir(c), "index.html").exists();
    }

    /** Põe a versão descarregada em uso. Chamar só quando a WebView não está a carregar ficheiros. */
    static synchronized boolean applyPending(Context c) {
        File p = pendingDir(c);
        int pv = prefs(c).getInt("pending", 0);
        if (pv <= 0 || !new File(p, "index.html").exists()) return false;
        File live = liveDir(c);
        deleteRec(live);
        if (!p.renameTo(live)) return false;
        prefs(c).edit().putInt("live", pv).putInt("pending", 0).apply();
        return true;
    }

    /** Limpa conteúdo antigo se o APK instalado já for igual ou mais recente. */
    static void cleanupIfApkNewer(Context c) {
        int v = prefs(c).getInt("live", 0);
        if (v > 0 && v <= BuildConfig.VERSION_CODE) {
            deleteRec(liveDir(c));
            prefs(c).edit().putInt("live", 0).apply();
        }
        int pv = prefs(c).getInt("pending", 0);
        if (pv > 0 && pv <= BuildConfig.VERSION_CODE) {
            deleteRec(pendingDir(c));
            prefs(c).edit().putInt("pending", 0).apply();
        }
    }

    static boolean dueForCheck(Context c, long minIntervalMs) {
        return System.currentTimeMillis() - prefs(c).getLong("checked", 0) > minIntervalMs;
    }

    /** Verifica o GitHub e descarrega o que houver de novo para "pendente". Corre fora da thread principal. */
    static Result check(Context c) {
        Result r = new Result();
        try {
            JSONObject rel = new JSONObject(get("https://api.github.com/repos/" + BuildConfig.UPDATE_REPO + "/releases/latest", 3000, 5000));
            prefs(c).edit().putLong("checked", System.currentTimeMillis()).apply();
            int remote = lastNumber(rel.optString("tag_name", ""));
            r.remoteVersion = remote;
            String zipUrl = null, metaUrl = null, apkUrl = null;
            JSONArray assets = rel.optJSONArray("assets");
            if (assets != null) {
                for (int i = 0; i < assets.length(); i++) {
                    JSONObject a = assets.getJSONObject(i);
                    String n = a.optString("name", "");
                    String u = a.optString("browser_download_url", null);
                    if (n.equals("web.zip")) zipUrl = u;
                    else if (n.equals("meta.json")) metaUrl = u;
                    else if (n.endsWith(".apk")) apkUrl = u;
                }
            }
            int have = Math.max(currentVersion(c), prefs(c).getInt("pending", 0));
            if (remote > have && zipUrl != null) {
                File tmpZip = new File(c.getCacheDir(), "web.zip");
                download(zipUrl, tmpZip);
                File p = pendingDir(c);
                deleteRec(p);
                unzip(tmpZip, p);
                //noinspection ResultOfMethodCallIgnored
                tmpZip.delete();
                if (new File(p, "index.html").exists()) {
                    prefs(c).edit().putInt("pending", remote).apply();
                    r.webUpdated = true;
                } else {
                    deleteRec(p);
                }
            }
            if (remote > BuildConfig.VERSION_CODE && metaUrl != null && apkUrl != null) {
                JSONObject meta = new JSONObject(get(metaUrl, 3000, 5000));
                String nativeId = meta.optString("native", "");
                if (!nativeId.isEmpty() && !nativeId.equals(BuildConfig.NATIVE_ID)) r.apkUrl = apkUrl;
            }
        } catch (Exception ignored) {
            // sem internet ou GitHub indisponível: continua com o que já tem
        }
        return r;
    }

    /* ---------- servir ficheiros: primeiro os descarregados, senão os do APK ---------- */
    static final class PathHandler implements WebViewAssetLoader.PathHandler {
        private final Context ctx;
        private final WebViewAssetLoader.AssetsPathHandler assets;

        PathHandler(Context ctx) {
            this.ctx = ctx.getApplicationContext();
            this.assets = new WebViewAssetLoader.AssetsPathHandler(ctx);
        }

        @Override
        public WebResourceResponse handle(String path) {
            try {
                if (liveActive(ctx)) {
                    File root = liveDir(ctx);
                    File f = new File(root, path);
                    if (f.getCanonicalPath().startsWith(root.getCanonicalPath() + File.separator) && f.isFile()) {
                        return new WebResourceResponse(mime(path), mime(path).startsWith("text") || path.endsWith(".js") ? "utf-8" : null, new FileInputStream(f));
                    }
                }
            } catch (Exception ignored) {
                // recorre aos ficheiros do APK
            }
            return assets.handle(path);
        }
    }

    private static String mime(String p) {
        String s = p.toLowerCase();
        if (s.endsWith(".html")) return "text/html";
        if (s.endsWith(".js")) return "application/javascript";
        if (s.endsWith(".css")) return "text/css";
        if (s.endsWith(".json")) return "application/json";
        if (s.endsWith(".svg")) return "image/svg+xml";
        if (s.endsWith(".png")) return "image/png";
        if (s.endsWith(".jpg") || s.endsWith(".jpeg")) return "image/jpeg";
        if (s.endsWith(".webp")) return "image/webp";
        if (s.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    /* ---------- utilitários ---------- */
    static int lastNumber(String tag) {
        int end = tag.length();
        while (end > 0 && !Character.isDigit(tag.charAt(end - 1))) end--;
        int start = end;
        while (start > 0 && Character.isDigit(tag.charAt(start - 1))) start--;
        if (start == end) return -1;
        try {
            return Integer.parseInt(tag.substring(start, end));
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private static HttpURLConnection open(String url, int connectMs, int readMs, int depth) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(false);
        c.setRequestProperty("User-Agent", "PintaComigo");
        c.setRequestProperty("Accept", "application/vnd.github+json, application/octet-stream, */*");
        c.setConnectTimeout(connectMs);
        c.setReadTimeout(readMs);
        int code = c.getResponseCode();
        if (code >= 300 && code < 400 && depth < 5) {
            String loc = c.getHeaderField("Location");
            c.disconnect();
            return open(loc, connectMs, readMs, depth + 1);
        }
        if (code != 200) throw new Exception("HTTP " + code);
        return c;
    }

    private static String get(String url, int connectMs, int readMs) throws Exception {
        HttpURLConnection c = open(url, connectMs, readMs, 0);
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"))) {
            String line;
            while ((line = br.readLine()) != null) sb.append(line).append('\n');
        }
        return sb.toString();
    }

    private static void download(String url, File out) throws Exception {
        HttpURLConnection c = open(url, 5000, 15000, 0);
        try (InputStream in = c.getInputStream(); FileOutputStream fos = new FileOutputStream(out)) {
            byte[] buf = new byte[32 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) fos.write(buf, 0, n);
        }
    }

    private static void unzip(File zip, File dest) throws Exception {
        //noinspection ResultOfMethodCallIgnored
        dest.mkdirs();
        String root = dest.getCanonicalPath() + File.separator;
        try (ZipInputStream zis = new ZipInputStream(new FileInputStream(zip))) {
            ZipEntry e;
            byte[] buf = new byte[32 * 1024];
            while ((e = zis.getNextEntry()) != null) {
                File f = new File(dest, e.getName());
                if (!f.getCanonicalPath().startsWith(root)) continue; // proteção contra caminhos maliciosos
                if (e.isDirectory()) {
                    //noinspection ResultOfMethodCallIgnored
                    f.mkdirs();
                    continue;
                }
                File parent = f.getParentFile();
                //noinspection ResultOfMethodCallIgnored
                if (parent != null) parent.mkdirs();
                try (FileOutputStream fos = new FileOutputStream(f)) {
                    int n;
                    while ((n = zis.read(buf)) > 0) fos.write(buf, 0, n);
                }
            }
        }
    }

    static void deleteRec(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteRec(k);
        //noinspection ResultOfMethodCallIgnored
        f.delete();
    }
}

package pt.pintacomigo.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.Toast;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Atualizações automáticas a partir dos "Releases" do GitHub.
 * Os desenhos vivem nos dados da app, que o Android mantém intactos quando a app é atualizada
 * (a nova versão é assinada com a mesma chave).
 */
final class Updater {

    private static final long INTERVAL_MS = 6L * 60 * 60 * 1000; // no máximo de 6 em 6 horas

    private Updater() {
    }

    static void checkDaily(Activity a) {
        SharedPreferences p = a.getSharedPreferences("updater", Context.MODE_PRIVATE);
        long last = p.getLong("last", 0);
        if (System.currentTimeMillis() - last > INTERVAL_MS) check(a, false);
    }

    static void check(final Activity a, final boolean manual) {
        new Thread(() -> {
            try {
                String api = "https://api.github.com/repos/" + BuildConfig.UPDATE_REPO + "/releases/latest";
                HttpURLConnection c = (HttpURLConnection) new URL(api).openConnection();
                c.setRequestProperty("Accept", "application/vnd.github+json");
                c.setRequestProperty("User-Agent", "PintaComigo");
                c.setConnectTimeout(10000);
                c.setReadTimeout(10000);
                int code = c.getResponseCode();
                a.getSharedPreferences("updater", Context.MODE_PRIVATE).edit().putLong("last", System.currentTimeMillis()).apply();
                if (code != 200) {
                    if (manual) toast(a, "Não há atualizações disponíveis");
                    return;
                }
                StringBuilder sb = new StringBuilder();
                try (BufferedReader br = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"))) {
                    String line;
                    while ((line = br.readLine()) != null) sb.append(line);
                }
                JSONObject j = new JSONObject(sb.toString());
                int remote = lastNumber(j.optString("tag_name", ""));
                String apkUrl = null;
                JSONArray assets = j.optJSONArray("assets");
                if (assets != null) {
                    for (int i = 0; i < assets.length(); i++) {
                        JSONObject as = assets.getJSONObject(i);
                        if (as.optString("name", "").endsWith(".apk")) {
                            apkUrl = as.optString("browser_download_url", null);
                            break;
                        }
                    }
                }
                if (remote > BuildConfig.VERSION_CODE && apkUrl != null) {
                    final String url = apkUrl;
                    final String version = "1." + remote;
                    a.runOnUiThread(() -> ask(a, url, version));
                } else if (manual) {
                    toast(a, "A app já está atualizada ✓");
                }
            } catch (Exception e) {
                if (manual) toast(a, "Sem internet. Tenta mais tarde.");
            }
        }).start();
    }

    private static int lastNumber(String tag) {
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

    private static void ask(final Activity a, final String url, String version) {
        if (a.isFinishing()) return;
        new AlertDialog.Builder(a)
                .setTitle("Nova versão da Pinta Comigo (" + version + ")")
                .setMessage("Há melhorias novas. Os desenhos ficam todos guardados.\n\nAtualizar agora?")
                .setPositiveButton("Atualizar", (d, w) -> download(a, url))
                .setNegativeButton("Mais tarde", null)
                .show();
    }

    private static void download(final Activity a, final String url) {
        toast(a, "A descarregar a nova versão…");
        new Thread(() -> {
            try {
                File dir = a.getExternalCacheDir() != null ? a.getExternalCacheDir() : a.getCacheDir();
                File out = new File(dir, "PintaComigo-update.apk");
                HttpURLConnection c = open(url, 0);
                try (InputStream in = c.getInputStream(); FileOutputStream fos = new FileOutputStream(out)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) fos.write(buf, 0, n);
                }
                a.runOnUiThread(() -> install(a, out));
            } catch (Exception e) {
                toast(a, "Não foi possível descarregar. Tenta mais tarde.");
            }
        }).start();
    }

    /* segue redireções (o GitHub manda o ficheiro a partir de outro servidor) */
    private static HttpURLConnection open(String url, int depth) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setInstanceFollowRedirects(false);
        c.setRequestProperty("User-Agent", "PintaComigo");
        c.setConnectTimeout(15000);
        c.setReadTimeout(60000);
        int code = c.getResponseCode();
        if (code >= 300 && code < 400 && depth < 5) {
            String loc = c.getHeaderField("Location");
            c.disconnect();
            return open(loc, depth + 1);
        }
        if (code != 200) throw new Exception("HTTP " + code);
        return c;
    }

    private static void install(Activity a, File apk) {
        try {
            Uri uri = FileProvider.getUriForFile(a, a.getPackageName() + ".files", apk);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            a.startActivity(i);
        } catch (Exception e) {
            toast(a, "Não foi possível abrir o instalador.");
        }
    }

    private static void toast(final Activity a, final String msg) {
        a.runOnUiThread(() -> Toast.makeText(a, msg, Toast.LENGTH_LONG).show());
    }
}

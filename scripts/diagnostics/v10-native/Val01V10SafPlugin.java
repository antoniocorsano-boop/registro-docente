package it.trama.registrodocente.prova;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * VAL-01/PRODUCT-05/S7d.3f: synthetic V10 SAF physical laboratory ONLY.
 * The plugin is injected ONLY into the disposable debug APK by CI.
 * It does not operate on professional records, credentials or V6-V9 backup.
 * A successful file readback is NOT an anti-rollback or official backup grant.
 */
@CapacitorPlugin(name = "Val01V10Saf")
public class Val01V10SafPlugin extends Plugin {
    private static final String PACKAGE = "it.trama.registrodocente.lab.v10";
    private static final String FILENAME = "LAB_V10_Synthetic_2031-02-01.enc.json";
    private static final int MAX_BYTES = 256 * 1024;
    private static final Set<String> LOCAL_PROVIDERS = new HashSet<>(Arrays.asList(
        "com.android.externalstorage.documents",
        "com.android.providers.downloads.documents"
    ));
    private boolean choosing = false;
    private boolean busy = false;
    private Uri destination;
    private String destinationToken;
    private Uri source;
    private String sourceToken;

    private boolean labOnly(PluginCall call) {
        Context context = getContext();
        if (context == null || !PACKAGE.equals(context.getPackageName())
                || (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0) {
            call.reject("Synthetic V10 SAF not authorized.", "PRODUCTION_FORBIDDEN");
            return false;
        }
        return true;
    }

    private static boolean local(Uri uri) {
        return uri != null && "content".equals(uri.getScheme())
                && LOCAL_PROVIDERS.contains(uri.getAuthority());
    }

    private static byte[] validated(String raw) throws Exception {
        if (raw == null || raw.length() == 0 || raw.length() > MAX_BYTES)
            throw new IllegalArgumentException("Invalid synthetic size");
        byte[] bytes = raw.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES) throw new IllegalArgumentException("Invalid size");
        JSONObject obj = new JSONObject(raw);
        if (obj.length() != 6 || !"val01-v10-saf-synthetic".equals(obj.optString("kind"))
                || !obj.optBoolean("syntheticOnly", false)
                || obj.optInt("version", -1) != 10
                || !"lab-only-not-official".equals(obj.optString("state"))) {
            throw new IllegalArgumentException("Not a V10 synthetic envelope");
        }
        byte[] iv = Base64.decode(obj.getString("iv"), Base64.NO_WRAP);
        byte[] sealed = Base64.decode(obj.getString("ciphertext"), Base64.NO_WRAP);
        if (iv.length != 12 || sealed.length < 16 || sealed.length > MAX_BYTES)
            throw new IllegalArgumentException("Invalid synthetic encryption");
        return bytes;
    }

    private static String hex(byte[] hash) {
        StringBuilder result = new StringBuilder(hash.length * 2);
        for (byte value : hash) result.append(String.format(java.util.Locale.ROOT, "%02x", value & 0xff));
        return result.toString();
    }

    private void clearSelections() {
        destination = null;
        destinationToken = null;
        source = null;
        sourceToken = null;
    }

    @PluginMethod
    public synchronized void chooseDestination(PluginCall call) {
        if (!labOnly(call)) return;
        if (choosing || busy) { call.reject("Synthetic SAF busy.", "BUSY"); return; }
        clearSelections();
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, FILENAME);
        intent.putExtra(Intent.EXTRA_LOCAL_ONLY, true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        choosing = true;
        try { startActivityForResult(call, intent, "destinationChosen"); }
        catch (RuntimeException e) {
            choosing = false;
            call.reject("Synthetic SAF picker failed.", "PICKER_FAILED");
        }
    }

    @ActivityCallback
    private synchronized void destinationChosen(PluginCall call, ActivityResult result) {
        boolean pending = choosing;
        choosing = false;
        if (call == null) return;
        if (!pending) { call.reject("Synthetic SAF interrupted.", "INTERRUPTED"); return; }
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            JSObject reply = new JSObject(); reply.put("status", "cancelled"); call.resolve(reply); return;
        }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || !local(uri)) {
            call.reject("Synthetic SAF local document required.", "LOCAL_ONLY"); return;
        }
        destination = uri;
        destinationToken = UUID.randomUUID().toString();
        JSObject reply = new JSObject();
        reply.put("status", "selected"); reply.put("token", destinationToken);
        call.resolve(reply);
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        if (!labOnly(call)) return;
        final Uri uri;
        synchronized (this) {
            String token = call.getString("token");
            if (choosing || busy || destination == null || destinationToken == null
                    || !destinationToken.equals(token)) {
                call.reject("Expired synthetic SAF destination.", "INVALID_DESTINATION"); return;
            }
            uri = destination;
            clearSelections(); // one use, even on failure
            busy = true;
        }
        try {
            byte[] bytes = validated(call.getString("encryptedText"));
            ContentResolver resolver = getContext().getContentResolver();
            try (OutputStream out = resolver.openOutputStream(uri, "wt")) {
                if (out == null) throw new IllegalStateException("Missing output");
                out.write(bytes);
                out.flush();
            }
            MessageDigest expected = MessageDigest.getInstance("SHA-256");
            byte[] hash = expected.digest(bytes);
            MessageDigest observed = MessageDigest.getInstance("SHA-256");
            long count = 0;
            try (InputStream in = resolver.openInputStream(uri)) {
                if (in == null) throw new IllegalStateException("Missing input");
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) != -1) {
                    count += n;
                    if (count > bytes.length) throw new IllegalStateException("Length mismatch");
                    observed.update(buf, 0, n);
                }
            }
            if (count != bytes.length || !MessageDigest.isEqual(hash, observed.digest()))
                throw new IllegalStateException("Readback mismatch");
            JSObject reply = new JSObject();
            reply.put("status", "lab-file-readback-verified-not-official");
            reply.put("bytes", bytes.length);
            reply.put("sha256", hex(hash));
            call.resolve(reply);
        } catch (Exception e) {
            call.reject("Synthetic SAF write not verified.", "WRITE_NOT_VERIFIED");
        } finally {
            synchronized (this) { busy = false; }
        }
    }

    @PluginMethod
    public synchronized void chooseSource(PluginCall call) {
        if (!labOnly(call)) return;
        if (choosing || busy) { call.reject("Synthetic SAF busy.", "BUSY"); return; }
        clearSelections();
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_LOCAL_ONLY, true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        choosing = true;
        try { startActivityForResult(call, intent, "sourceChosen"); }
        catch (RuntimeException e) {
            choosing = false;
            call.reject("Synthetic SAF source picker failed.", "PICKER_FAILED");
        }
    }

    @ActivityCallback
    private synchronized void sourceChosen(PluginCall call, ActivityResult result) {
        boolean pending = choosing;
        choosing = false;
        if (call == null) return;
        if (!pending) { call.reject("Synthetic SAF interrupted.", "INTERRUPTED"); return; }
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            JSObject reply = new JSObject(); reply.put("status", "cancelled"); call.resolve(reply); return;
        }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || !local(uri)) {
            call.reject("Synthetic SAF local source required.", "LOCAL_ONLY"); return;
        }
        source = uri;
        sourceToken = UUID.randomUUID().toString();
        JSObject reply = new JSObject();
        reply.put("status", "selected"); reply.put("token", sourceToken);
        call.resolve(reply);
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        if (!labOnly(call)) return;
        final Uri uri;
        synchronized (this) {
            String token = call.getString("token");
            if (choosing || busy || source == null || sourceToken == null
                    || !sourceToken.equals(token)) {
                call.reject("Expired synthetic SAF source.", "INVALID_SOURCE"); return;
            }
            uri = source;
            clearSelections(); // one use
            busy = true;
        }
        try {
            byte[] bytes;
            try (InputStream in = getContext().getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                if (in == null) throw new IllegalStateException("Missing input");
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) != -1) {
                    if (n > MAX_BYTES - out.size()) throw new IllegalArgumentException("Too large");
                    out.write(buf, 0, n);
                }
                bytes = out.toByteArray();
            }
            String text = new String(bytes, StandardCharsets.UTF_8);
            if (!Arrays.equals(bytes, text.getBytes(StandardCharsets.UTF_8)))
                throw new IllegalArgumentException("Invalid UTF-8");
            validated(text);
            JSObject reply = new JSObject();
            reply.put("status", "lab-file-read-not-official");
            reply.put("encryptedText", text);
            reply.put("bytes", bytes.length);
            reply.put("sha256", hex(MessageDigest.getInstance("SHA-256").digest(bytes)));
            call.resolve(reply);
        } catch (Exception e) {
            call.reject("Synthetic SAF source not verified.", "READ_NOT_VERIFIED");
        } finally {
            synchronized (this) { busy = false; }
        }
    }
}

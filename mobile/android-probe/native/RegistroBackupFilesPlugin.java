package it.trama.registrodocente.prova;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.Intent;
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
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Iterator;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name = "RegistroBackupFiles")
public class RegistroBackupFilesPlugin extends Plugin {
    private static final int MAX_BYTES = 32 * 1024 * 1024;
    private static final Set<String> LOCAL_PROVIDERS = Set.of(
        "com.android.externalstorage.documents",
        "com.android.providers.downloads.documents"
    );
    private static final Set<String> ENVELOPE_KEYS = Set.of(
        "privacy_protocol", "version", "timestamp", "kdf", "salt", "iv", "ciphertext"
    );
    private boolean pickerOpen = false;
    private boolean writing = false;
    private Uri destination;
    private String destinationToken;

    // No storage-wide permission, path supplied by JS, persisted URI grant or remote endpoint.
    @PluginMethod
    public synchronized void chooseBackupDestination(PluginCall call) {
        String filename = call.getString("filename");
        if (filename == null || !filename.matches("Backup_Cifrato_GDPR_[0-9]{4}-[0-9]{2}-[0-9]{2}\\.enc\\.json")) {
            call.reject("Nome della copia di sicurezza non valido.", "INVALID_FILENAME");
            return;
        }
        if (pickerOpen || writing) {
            call.reject("Un salvataggio è già in corso.", "BUSY");
            return;
        }
        destination = null;
        destinationToken = null;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        intent.putExtra(Intent.EXTRA_LOCAL_ONLY, true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        pickerOpen = true;
        try {
            startActivityForResult(call, intent, "destinationChosen");
        } catch (RuntimeException exception) {
            pickerOpen = false;
            call.reject("Impossibile aprire il selettore documenti Android.", "PICKER_FAILED");
        }
    }

    @ActivityCallback
    private synchronized void destinationChosen(PluginCall call, ActivityResult result) {
        boolean wasOpen = pickerOpen;
        pickerOpen = false;
        if (call == null) return;
        // A process restart must never resume a previous save or invent a receipt.
        if (!wasOpen) {
            call.reject("Salvataggio interrotto. Riprova.", "INTERRUPTED");
            return;
        }
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            JSObject reply = new JSObject();
            reply.put("status", "cancelled");
            call.resolve(reply);
            return;
        }
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null
                || !"content".equals(uri.getScheme()) || !LOCAL_PROVIDERS.contains(uri.getAuthority())) {
            call.reject("Scegli una cartella locale, ad esempio Download o Documenti.", "LOCAL_DESTINATION_REQUIRED");
            return;
        }
        destination = uri;
        destinationToken = UUID.randomUUID().toString();
        JSObject reply = new JSObject();
        reply.put("status", "selected");
        reply.put("token", destinationToken);
        call.resolve(reply);
    }

    @PluginMethod
    public void writeEncryptedBackup(PluginCall call) {
        final Uri uri;
        synchronized (this) {
            String token = call.getString("token");
            if (writing || pickerOpen || destination == null || destinationToken == null
                    || !destinationToken.equals(token)) {
                call.reject("Destinazione scaduta. Seleziona nuovamente il file.", "INVALID_DESTINATION");
                return;
            }
            uri = destination;
            destination = null;
            destinationToken = null; // one use, including failure
            writing = true;
        }

        try {
            String encrypted = call.getString("encryptedText");
            byte[] bytes = validateEnvelope(encrypted);
            ContentResolver resolver = getContext().getContentResolver();
            // Close the output before reopening for independent read-back verification.
            try (OutputStream out = resolver.openOutputStream(uri, "wt")) {
                if (out == null) throw new IllegalStateException("No output stream");
                out.write(bytes);
                out.flush();
            }

            MessageDigest expected = MessageDigest.getInstance("SHA-256");
            byte[] expectedHash = expected.digest(bytes);
            MessageDigest actual = MessageDigest.getInstance("SHA-256");
            long count = 0;
            try (InputStream in = resolver.openInputStream(uri)) {
                if (in == null) throw new IllegalStateException("No input stream");
                byte[] buffer = new byte[16384];
                int n;
                while ((n = in.read(buffer)) != -1) {
                    count += n;
                    if (count > bytes.length) throw new IllegalStateException("Length mismatch");
                    actual.update(buffer, 0, n);
                }
            }
            byte[] actualHash = actual.digest();
            if (count != bytes.length || !MessageDigest.isEqual(expectedHash, actualHash)) {
                throw new IllegalStateException("Read-back mismatch");
            }
            JSObject receipt = new JSObject();
            receipt.put("status", "verified");
            receipt.put("bytes", bytes.length);
            receipt.put("sha256", hex(actualHash));
            call.resolve(receipt);
        } catch (Exception exception) {
            // Never include the URI, ciphertext, password or provider exception in logs or replies.
            // A partial file may remain in the chosen folder; no backup receipt is issued.
            call.reject("Copia non verificata. Controlla la cartella scelta e riprova.", "WRITE_NOT_VERIFIED");
        } finally {
            synchronized (this) { writing = false; }
        }
    }

    private static byte[] validateEnvelope(String encrypted) throws Exception {
        if (encrypted == null || encrypted.isEmpty() || encrypted.length() > MAX_BYTES) {
            throw new IllegalArgumentException("Invalid size");
        }
        byte[] bytes = encrypted.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BYTES) throw new IllegalArgumentException("Invalid size");
        JSONObject json = new JSONObject(encrypted);
        if (json.length() != ENVELOPE_KEYS.size()) throw new IllegalArgumentException("Invalid envelope");
        Iterator<String> keys = json.keys();
        while (keys.hasNext()) {
            if (!ENVELOPE_KEYS.contains(keys.next())) throw new IllegalArgumentException("Invalid key");
        }
        JSONObject kdf = json.getJSONObject("kdf");
        if (!"REGISTRO_DOCENTE_AES_GCM_256".equals(json.getString("privacy_protocol"))
                || json.getInt("version") != 2 || json.getString("timestamp").isEmpty()
                || kdf.length() != 3 || !"PBKDF2".equals(kdf.getString("name"))
                || !"SHA-256".equals(kdf.getString("hash")) || kdf.getInt("iterations") != 600000
                || Base64.decode(json.getString("salt"), Base64.DEFAULT).length != 16
                || Base64.decode(json.getString("iv"), Base64.DEFAULT).length != 12
                || Base64.decode(json.getString("ciphertext"), Base64.DEFAULT).length < 16) {
            throw new IllegalArgumentException("Invalid encrypted envelope");
        }
        return bytes;
    }

    private static String hex(byte[] bytes) {
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) result.append(String.format(java.util.Locale.ROOT, "%02x", b & 0xff));
        return result.toString();
    }
}

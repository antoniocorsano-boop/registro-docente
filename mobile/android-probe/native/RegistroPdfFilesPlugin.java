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
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(name = "RegistroPdfFiles")
public class RegistroPdfFilesPlugin extends Plugin {
    private static final int MAX_BYTES = 32 * 1024 * 1024;
    private static final Set<String> LOCAL_PROVIDERS = new HashSet<>(Arrays.asList(
        "com.android.externalstorage.documents", "com.android.providers.downloads.documents"
    ));
    private boolean pickerOpen;
    private boolean writing;
    private Uri destination;
    private String destinationToken;

    @PluginMethod
    public synchronized void choosePdfDestination(PluginCall call) {
        String filename = call.getString("filename");
        if (filename == null || !filename.matches("(?:Prospetto_Lavoro|Bilancio_Formativo)_[0-9]{4}-[0-9]{2}-[0-9]{2}\\.pdf")) {
            call.reject("Nome PDF non valido.", "INVALID_FILENAME");
            return;
        }
        if (pickerOpen || writing) {
            call.reject("Un salvataggio è già in corso.", "BUSY");
            return;
        }
        destination = null;
        destinationToken = null;
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.setType("application/pdf");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        intent.putExtra(Intent.EXTRA_LOCAL_ONLY, true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        pickerOpen = true;
        try {
            startActivityForResult(call, intent, "pdfDestinationChosen");
        } catch (RuntimeException exception) {
            pickerOpen = false;
            call.reject("Selettore PDF non disponibile.", "PICKER_FAILED");
        }
    }

    @ActivityCallback
    private synchronized void pdfDestinationChosen(PluginCall call, ActivityResult result) {
        boolean wasOpen = pickerOpen;
        pickerOpen = false;
        if (call == null) return;
        if (!wasOpen) {
            call.reject("Salvataggio PDF interrotto.", "INTERRUPTED");
            return;
        }
        JSObject reply = new JSObject();
        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            reply.put("status", "cancelled");
            call.resolve(reply);
            return;
        }
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null
                || !"content".equals(uri.getScheme()) || !LOCAL_PROVIDERS.contains(uri.getAuthority())) {
            call.reject("Scegli una cartella locale (Download o Documenti).", "LOCAL_DESTINATION_REQUIRED");
            return;
        }
        destination = uri;
        destinationToken = UUID.randomUUID().toString();
        reply.put("status", "selected");
        reply.put("token", destinationToken);
        call.resolve(reply);
    }

    @PluginMethod
    public void writePdf(PluginCall call) {
        final Uri uri;
        synchronized (this) {
            String token = call.getString("token");
            if (writing || pickerOpen || destination == null || destinationToken == null || !destinationToken.equals(token)) {
                call.reject("Destinazione PDF scaduta.", "INVALID_DESTINATION");
                return;
            }
            uri = destination;
            destination = null;
            destinationToken = null;
            writing = true;
        }
        try {
            String encoded = call.getString("pdfBase64");
            if (encoded == null || encoded.length() > ((MAX_BYTES + 2L) / 3L) * 4L)
                throw new IllegalArgumentException("Invalid size");
            byte[] bytes = Base64.decode(encoded, Base64.NO_WRAP);
            if (bytes.length < 5 || bytes.length > MAX_BYTES || bytes[0] != '%' || bytes[1] != 'P'
                    || bytes[2] != 'D' || bytes[3] != 'F' || bytes[4] != '-')
                throw new IllegalArgumentException("Invalid PDF");
            ContentResolver resolver = getContext().getContentResolver();
            try (OutputStream out = resolver.openOutputStream(uri, "wt")) {
                if (out == null) throw new IllegalStateException("Missing stream");
                out.write(bytes);
                out.flush();
            }
            byte[] expected = MessageDigest.getInstance("SHA-256").digest(bytes);
            MessageDigest actual = MessageDigest.getInstance("SHA-256");
            long count = 0;
            try (InputStream in = resolver.openInputStream(uri)) {
                if (in == null) throw new IllegalStateException("Missing stream");
                byte[] buffer = new byte[16384];
                int n;
                while ((n = in.read(buffer)) != -1) {
                    count += n;
                    if (count > bytes.length) throw new IllegalStateException("Length mismatch");
                    actual.update(buffer, 0, n);
                }
            }
            byte[] hash = actual.digest();
            if (count != bytes.length || !MessageDigest.isEqual(expected, hash)) throw new IllegalStateException("Read-back mismatch");
            StringBuilder hex = new StringBuilder(64);
            for (byte value : hash) hex.append(String.format(java.util.Locale.ROOT, "%02x", value & 0xff));
            JSObject receipt = new JSObject();
            receipt.put("status", "verified");
            receipt.put("bytes", bytes.length);
            receipt.put("sha256", hex.toString());
            call.resolve(receipt);
        } catch (Exception exception) {
            // Never log the document or destination. A partial file may remain.
            call.reject("PDF non verificato. Controlla la cartella scelta.", "WRITE_NOT_VERIFIED");
        } finally {
            synchronized (this) { writing = false; }
        }
    }
}

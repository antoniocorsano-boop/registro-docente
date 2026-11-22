package it.trama.registrodocente.prova;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.util.Objects;

/**
 * VAL-01/PRODUCT-05/S7d.3d.1 — TEST FIXTURE ONLY.
 *
 * This class is copied into a uniquely named synthetic Android debug APK by
 * val01-v10-physical-lab.yml; it is NEVER compiled into the professional app.
 * Synchronous SharedPreferences.commit() + readback evaluates local durability
 * over force-stop. It is NOT an independent non-rollback monotonic root.
 * Seed is deliberately available for synthetic failure/rollback injection ONLY.
 */
@CapacitorPlugin(name = "Val01V10Witness")
public class Val01V10WitnessPlugin extends Plugin {
    private static final String PACKAGE = "it.trama.registrodocente.lab.v10";
    private static final String PREFS = "val01_v10_synthetic_witness";
    private static final String RECORD = "synthetic_current";
    private static final String ABSENT = "{\"kind\":\"confirmed-absent\"}";

    private boolean labOnly(PluginCall call) {
        Context context = getContext();
        if (context == null || !PACKAGE.equals(context.getPackageName()) ||
                (context.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) == 0) {
            call.reject("Synthetic Android witness not authorized.", "PRODUCTION_FORBIDDEN");
            return false;
        }
        return true;
    }

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private static boolean hex(String value) {
        return value != null && value.matches("[0-9a-f]{64}");
    }

    private static boolean valid(String raw) {
        if (raw == null || raw.length() > 512) return false;
        if (ABSENT.equals(raw)) return true;
        try {
            JSONObject obj = new JSONObject(raw);
            if (!"established".equals(obj.optString("kind")) || obj.length() != 2) return false;
            JSONObject head = obj.optJSONObject("head");
            if (head == null || head.length() != 4) return false;
            int epoch = head.getInt("epoch");
            return epoch >= 1 && epoch <= 1000 &&
                    hex(head.getString("headDigest")) &&
                    hex(head.getString("sessionBinding")) &&
                    hex(head.getString("snapshotDigest"));
        } catch (Exception ignored) {
            return false;
        }
    }

    @PluginMethod
    public synchronized void read(PluginCall call) {
        if (!labOnly(call)) return;
        JSObject result = new JSObject();
        result.put("value", preferences().getString(RECORD, null));
        call.resolve(result);
    }

    @PluginMethod
    public synchronized void compareAndAdvance(PluginCall call) {
        if (!labOnly(call)) return;
        String expected = call.getString("expected");
        String next = call.getString("next");
        if (!valid(expected) || !valid(next) || ABSENT.equals(next) ||
                !Objects.equals(preferences().getString(RECORD, null), expected)) {
            JSObject reply = new JSObject();
            reply.put("advanced", false);
            call.resolve(reply);
            return;
        }
        try {
            JSONObject nextHead = new JSONObject(next).getJSONObject("head");
            JSONObject expectedState = new JSONObject(expected);
            final int oldEpoch;
            if ("confirmed-absent".equals(expectedState.getString("kind"))) {
                oldEpoch = 0;
            } else {
                JSONObject old = expectedState.getJSONObject("head");
                oldEpoch = old.getInt("epoch");
                if (!Objects.equals(old.getString("sessionBinding"),
                        nextHead.getString("sessionBinding"))) {
                    call.reject("Synthetic session mismatch.", "INVALID_SESSION");
                    return;
                }
            }
            if (nextHead.getInt("epoch") != oldEpoch + 1) {
                call.reject("Nonmonotonic synthetic epoch.", "NONMONOTONIC_EPOCH");
                return;
            }
        } catch (Exception e) {
            call.reject("Invalid synthetic witness.", "INVALID_SHAPE");
            return;
        }
        // commit() is synchronous; an aborted/failed write is not a receipt.
        boolean committed = preferences().edit().putString(RECORD, next).commit();
        boolean verified = Objects.equals(preferences().getString(RECORD, null), next);
        if (!committed || !verified) {
            call.reject("Synthetic witness not durable.", "READBACK_FAILED");
            return;
        }
        JSObject reply = new JSObject();
        reply.put("advanced", true);
        call.resolve(reply);
    }

    /** Synthetic-only fault injection, deliberately capable of rollback.
     * This definitively demonstrates that SharedPreferences is NOT an
     * independently trusted anti-rollback witness.
     */
    @PluginMethod
    public synchronized void seedForTest(PluginCall call) {
        if (!labOnly(call)) return;
        String value = call.getString("value");
        if (value != null && !valid(value)) {
            call.reject("Invalid synthetic state.", "INVALID_SHAPE");
            return;
        }
        SharedPreferences.Editor editor = preferences().edit();
        if (value == null) editor.remove(RECORD);
        else editor.putString(RECORD, value);
        boolean committed = editor.commit();
        if (!committed || !Objects.equals(preferences().getString(RECORD, null), value)) {
            call.reject("Synthetic seed/readback failed.", "READBACK_FAILED");
            return;
        }
        JSObject reply = new JSObject();
        reply.put("stored", true);
        call.resolve(reply);
    }
}

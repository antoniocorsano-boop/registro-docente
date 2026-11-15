package it.trama.registrodocente.prova;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Native foreground generation; never receives credentials or archive data. */
@CapacitorPlugin(name = "RegistroSession")
public class RegistroSessionPlugin extends Plugin {
    @PluginMethod
    public void getState(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!(getActivity() instanceof MainActivity)) {
                call.reject("Sessione Android non disponibile.");
                return;
            }
            call.resolve(((MainActivity) getActivity()).readSessionState());
        });
    }

    @PluginMethod
    public void authorize(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Integer epoch = call.getInt("epoch");
            if (!(getActivity() instanceof MainActivity) || epoch == null
                    || !((MainActivity) getActivity()).authorizeSessionEpoch(epoch)) {
                call.reject("Sessione Android cambiata. Autenticati nuovamente.");
                return;
            }
            call.resolve(new JSObject());
        });
    }

    @PluginMethod
    public void acknowledgeShield(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            Integer epoch = call.getInt("epoch");
            if (!(getActivity() instanceof MainActivity) || epoch == null) {
                call.reject("Superficie protetta: attendi il rientro nel Registro.");
                return;
            }
            ((MainActivity) getActivity()).acknowledgeProtectedSurface(epoch,
                    () -> call.resolve(new JSObject()),
                    () -> call.reject("Superficie protetta: attendi il rientro nel Registro."));
        });
    }
}

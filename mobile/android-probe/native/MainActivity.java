package it.trama.registrodocente.prova;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(RegistroBackupFilesPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

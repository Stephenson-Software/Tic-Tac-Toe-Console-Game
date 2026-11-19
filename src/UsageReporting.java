import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Properties;

/**
 * Reports that the game was played to the trace service
 * (https://trace.danielstephenson.dev), so that it is known whether anybody runs it.
 *
 * Two events are sent, from the client's background thread, each tagged with the
 * program version: "startup" once per run, and "game-finished" when a game ends, also
 * tagged with the result (won, lost or tie). Nothing else is ever sent: no moves, no
 * usernames, hostnames, paths or IP addresses.
 *
 * Reporting is on by default. It is switched off with enabled=false in the settings
 * file (~/.config/tic-tac-toe-console-game/usage-reporting.properties, written with its
 * defaults, alongside a one-line notice, the first time the game reports), or with the
 * environment variables every trace client honours, TRACE_USAGE_REPORTING=off and
 * DO_NOT_TRACK=1, which the client checks before the settings file. Every switch fails
 * closed: enabled keeps reporting on only when it is true, on, yes or 1 (or missing), and
 * a settings file that is there but cannot be read turns reporting off. Nothing in here
 * can stop the game: a settings file that cannot be written leaves reporting at its
 * defaults, and the client never throws.
 *
 * Details: https://danielstephenson.dev/usage-reporting
 */
public class UsageReporting {
	/** The name the program key was issued for; the application of every event. */
	static final String APPLICATION = "Tic-Tac-Toe-Console-Game";
	/** Sent as the version tag of every event. Raise it when the game changes. */
	static final String VERSION = "0.1.0";
	static final String DEFAULT_ENDPOINT = "https://trace.danielstephenson.dev";
	/** The write key issued to this game by trace. It can only add usage events and is not secret. */
	static final String KEY = "oTgCaEMaZsygwGvVaF9lmfqZw6YA1eRF9UnFwyPrVuQ";
	static final String DETAILS_URL = "https://danielstephenson.dev/usage-reporting";
	static final String SETTINGS_FILE_NAME = "usage-reporting.properties";
	static final String ENABLED_KEY = "enabled";
	static final String ENDPOINT_KEY = "endpoint";

	private final File settingsFile;
	private TraceClient client = TraceClient.disabled();

	public UsageReporting() {
		this(defaultSettingsFile());
	}

	UsageReporting(File settingsFile) {
		this.settingsFile = settingsFile;
	}

	/** ~/.config/tic-tac-toe-console-game/usage-reporting.properties, or null without a home. */
	static File defaultSettingsFile() {
		String home = System.getProperty("user.home");
		if (home == null || home.trim().isEmpty()) {
			return null;
		}
		return new File(new File(new File(home, ".config"), "tic-tac-toe-console-game"), SETTINGS_FILE_NAME);
	}

	/** The random installation ID's file, next to the settings file; null without a home. */
	File installIdFile() {
		return settingsFile == null ? null : new File(settingsFile.getAbsoluteFile().getParentFile(), TraceInstallId.FILE_NAME);
	}

	/** Reads the settings (writing them on the first run), shows the notice once, and reports startup. */
	public void start() {
		boolean firstRun = settingsFile != null && !settingsFile.exists();
		Properties settings = readSettings();
		// A settings file that is there but cannot be read may say enabled=false: count it as off.
		boolean unreadable = settings == null;
		if (unreadable) {
			settings = new Properties();
		}
		try {
			// -Dusage-reporting.endpoint=... points a run at a local stub without touching the file.
			String endpoint = System.getProperty("usage-reporting.endpoint", settings.getProperty(ENDPOINT_KEY, DEFAULT_ENDPOINT));
			client = TraceClient.builder(endpoint.trim(), APPLICATION, VERSION)
					.key(KEY)
					.enabled(!unreadable && enabledBy(settings))
					// Resolved by the client only once it knows reporting is on.
					.installId(TraceInstallId.fromEnvironment())
					.installIdFile(installIdFile())
					.build();
		} catch (RuntimeException badEndpoint) {
			client = TraceClient.disabled();
		}
		if (firstRun && client.isEnabled()) {
			// Printed only once the client is built, so an environment that has already
			// turned reporting off is never told it is on; the settings file is written
			// only then too, so that the notice is still shown on the first run that reports.
			System.out.println(firstRunNotice());
			writeDefaultSettings();
		}
		client.report("startup");
	}

	/**
	 * Whether the settings allow reporting. Fails closed through the client's helper: a
	 * missing enabled line keeps the default (on), but once the line is there only true, on,
	 * yes or 1 keep reporting on, so false, off, no, 0, a blank value or a typo turn it off.
	 */
	static boolean enabledBy(Properties settings) {
		return TraceClient.allowsReporting(settings.getProperty(ENABLED_KEY, "true"));
	}

	/** Reports that a game ended with the given result: "won", "lost" or "tie". */
	public void gameFinished(String result) {
		client.report("game-finished", null, Collections.singletonMap("result", result));
	}

	/** Gives a report still in flight a moment (at most a few seconds) to leave before exit. */
	public void close() {
		client.close();
	}

	public boolean isEnabled() {
		return client.isEnabled();
	}

	String firstRunNotice() {
		return "Usage reporting is on: " + APPLICATION + " sends its name, version, a random installation ID and"
				+ " each game's result (won, lost or tie) to " + DEFAULT_ENDPOINT + " - nothing about you or your moves."
				+ " Turn it off with " + ENABLED_KEY + "=false in " + settingsFile.getPath()
				+ ", or with TRACE_USAGE_REPORTING=off in the environment. Details: " + DETAILS_URL;
	}

	/** The settings; empty when there is no file yet, null when the file cannot be read. */
	private Properties readSettings() {
		Properties settings = new Properties();
		if (settingsFile == null) {
			return settings;
		}
		if (!settingsFile.exists()) {
			return settings;
		}
		try (InputStream in = new FileInputStream(settingsFile)) {
			settings.load(in);
		} catch (IOException | RuntimeException unreadable) {
			// Reporting is off until the file can be read; the game is never affected.
			return null;
		}
		return settings;
	}

	private void writeDefaultSettings() {
		File directory = settingsFile.getParentFile();
		if (directory != null && !directory.exists() && !directory.mkdirs()) {
			return;
		}
		try (Writer writer = new OutputStreamWriter(new FileOutputStream(settingsFile), StandardCharsets.UTF_8)) {
			writer.write("# Usage reporting for " + APPLICATION + ".\n");
			writer.write("# When enabled, a 'startup' event (name and version) and a 'game-finished' event\n");
			writer.write("# (version, and won, lost or tie) are sent to " + DEFAULT_ENDPOINT + ", each with a random\n");
			writer.write("# installation ID kept in " + TraceInstallId.FILE_NAME + " next to this file (delete it to get a new\n");
			writer.write("# one). Nothing else is ever sent.\n");
			writer.write("# Set enabled to false to turn it off. TRACE_USAGE_REPORTING=off or DO_NOT_TRACK=1\n");
			writer.write("# in the environment turns it off too, whatever this file says.\n");
			writer.write("# Details: " + DETAILS_URL + "\n");
			writer.write(ENABLED_KEY + "=true\n");
		} catch (IOException | RuntimeException unwritable) {
			// The notice is shown again next run; that is the worst case, and it is harmless.
		}
	}
}

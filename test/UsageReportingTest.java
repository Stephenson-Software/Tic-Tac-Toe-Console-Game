import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Properties;

/**
 * Checks that the game's own usage-reporting switch fails closed: once an operator has
 * turned it off, in whatever words, nothing turns it back on. No check here contacts the
 * trace service: every run is pointed at a closed loopback port.
 */
public class UsageReportingTest {
	static int failures = 0;

	public static void main(String[] args) throws IOException {
		System.setProperty("usage-reporting.endpoint", "http://127.0.0.1:9");

		enabledBy_onlyAnOnValueOrAMissingLineKeepsReportingOn();
		start_respectsAnOptOutInTheSettingsFileAndKeepsIt();
		start_withAnUnreadableSettingsFileReportsNothing();

		if (failures > 0) {
			System.out.println(failures + " check(s) failed");
			System.exit(1);
		}
		System.out.println("All UsageReporting checks passed");
	}

	static void check(String name, boolean condition) {
		if (condition == false) {
			failures++;
			System.out.println("FAIL: " + name);
		}
	}

	static Properties settings(String enabled) {
		Properties settings = new Properties();
		if (enabled != null) {
			settings.setProperty(UsageReporting.ENABLED_KEY, enabled);
		}
		return settings;
	}

	public static void enabledBy_onlyAnOnValueOrAMissingLineKeepsReportingOn() {
		for (String off : new String[] {"false", "FALSE", " false ", "off", "no", "0", "", "  ", "disabled", "flase"}) {
			check("enabled=" + off + " is off", UsageReporting.enabledBy(settings(off)) == false);
		}
		for (String on : new String[] {"true", "TRUE", " true ", "on", "yes", "1"}) {
			check("enabled=" + on + " is on", UsageReporting.enabledBy(settings(on)) == true);
		}
		check("no enabled line keeps the default (on)", UsageReporting.enabledBy(settings(null)) == true);
	}

	public static void start_respectsAnOptOutInTheSettingsFileAndKeepsIt() throws IOException {
		for (String off : new String[] {"false", "off", "no", "0", ""}) {
			File dir = Files.createTempDirectory("ttt-usage").toFile();
			File file = new File(dir, UsageReporting.SETTINGS_FILE_NAME);
			String contents = "enabled=" + off + "\n";
			try (Writer writer = new OutputStreamWriter(new FileOutputStream(file), StandardCharsets.UTF_8)) {
				writer.write(contents);
			}
			UsageReporting reporting = new UsageReporting(file);
			reporting.start();
			reporting.close();
			check("enabled=" + off + " in the file reports nothing", reporting.isEnabled() == false);
			check("enabled=" + off + " is left as written",
					contents.equals(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8)));
			check("enabled=" + off + " creates no installation ID",
					new File(dir, TraceInstallId.FILE_NAME).exists() == false);
		}
	}

	public static void start_withAnUnreadableSettingsFileReportsNothing() throws IOException {
		// A directory where the settings file should be exists but cannot be read as one.
		File dir = Files.createTempDirectory("ttt-usage").toFile();
		File file = new File(dir, UsageReporting.SETTINGS_FILE_NAME);
		check("set-up: settings path is a directory", file.mkdir());
		UsageReporting reporting = new UsageReporting(file);
		reporting.start();
		reporting.close();
		check("an unreadable settings file reports nothing", reporting.isEnabled() == false);
		check("an unreadable settings file is left alone", file.isDirectory());
	}
}

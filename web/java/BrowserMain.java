import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintStream;
import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;

/**
 * Browser-only entry point, used when the game runs under CheerpJ (web/index.html).
 * It is compiled only by the browser build (web/build.sh), never by the console build.
 *
 * CheerpJ offers no interactive standard input, so System.in and System.out are
 * replaced with streams backed by two JavaScript natives implemented by the page:
 * readLine() resolves with the next line typed into the page's input field, and
 * write(String) appends text to the page's terminal. The game itself (TicTacToe,
 * ThreeByThreeGrid) runs unchanged and still reads its moves with a Scanner on System.in.
 *
 * Usage reporting is not started here: a browser tab has no settings file or
 * environment to turn it off with, so the browser build never reports.
 */
public class BrowserMain {

	/** Resolves with the next line the player submits, without its line terminator. */
	static native String readLine();

	/** Appends text to the page's terminal. */
	static native void write(String text);

	public static void main(String[] args) throws UnsupportedEncodingException {
		System.setIn(new LineInputStream());
		System.setOut(new PrintStream(new PageOutputStream(), true, "UTF-8"));

		while (true) {
			new TicTacToe(new ThreeByThreeGrid()).play();
			System.out.println();
			System.out.println("Press Enter to play again.");
			readLine();
		}
	}

	/** Feeds System.in one submitted line at a time, blocking until the page supplies one. */
	static final class LineInputStream extends InputStream {
		private byte[] buffer = new byte[0];
		private int position;

		private boolean fill() {
			while (position >= buffer.length) {
				String line = readLine();
				if (line == null) {
					return false;
				}
				buffer = (line + "\n").getBytes(StandardCharsets.UTF_8);
				position = 0;
			}
			return true;
		}

		@Override
		public int read() {
			if (!fill()) {
				return -1;
			}
			return buffer[position++] & 0xff;
		}

		@Override
		public int read(byte[] target, int offset, int length) {
			if (length == 0) {
				return 0;
			}
			if (!fill()) {
				return -1;
			}
			int count = Math.min(length, buffer.length - position);
			System.arraycopy(buffer, position, target, offset, count);
			position += count;
			return count;
		}

		@Override
		public int available() {
			return buffer.length - position;
		}
	}

	/** Collects bytes and hands them to the page as text on every flush. */
	static final class PageOutputStream extends OutputStream {
		private final ByteArrayOutputStream pending = new ByteArrayOutputStream();

		@Override
		public void write(int b) {
			pending.write(b);
		}

		@Override
		public void write(byte[] bytes, int offset, int length) {
			pending.write(bytes, offset, length);
		}

		@Override
		public void flush() throws IOException {
			if (pending.size() > 0) {
				String text = new String(pending.toByteArray(), StandardCharsets.UTF_8);
				pending.reset();
				BrowserMain.write(text);
			}
		}
	}
}

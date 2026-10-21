
public class ThreeByThreeGridTest {
	static int failures = 0;

	static final String[] COLUMNS = {"a", "b", "c"};

	// the eight winning lines, as {column, row} pairs
	static final String[][][] LINES = {
		{{"a", "1"}, {"b", "1"}, {"c", "1"}},
		{{"a", "2"}, {"b", "2"}, {"c", "2"}},
		{{"a", "3"}, {"b", "3"}, {"c", "3"}},
		{{"a", "1"}, {"a", "2"}, {"a", "3"}},
		{{"b", "1"}, {"b", "2"}, {"b", "3"}},
		{{"c", "1"}, {"c", "2"}, {"c", "3"}},
		{{"a", "1"}, {"b", "2"}, {"c", "3"}},
		{{"c", "1"}, {"b", "2"}, {"a", "3"}}
	};

	public static void main(String[] args) {
		newGrid_isEmpty();
		changeBox_writesOnlyTheNamedSpace();
		changeBox_mapsColumnToSecondIndexAndRowToFirst();
		checkIfThreeXInARow_everyLine();
		checkIfThreeOInARow_everyLine();
		winChecks_ignoreTheOtherMark();
		winChecks_ignoreMixedLines();
		checkIfThreeInARow_checksTheGivenMark();
		checkIfGridFull_onlyWhenNoSpaceIsLeft();
		columnIndex_mapsEachLetterToItsColumn();
		unknownColumn_isTreatedAsColumnA();

		if (failures > 0) {
			System.out.println(failures + " check(s) failed");
			System.exit(1);
		}
		System.out.println("All ThreeByThreeGrid checks passed");
	}

	static void check(String name, boolean condition) {
		if (condition == false) {
			System.out.println("FAIL: " + name);
			failures++;
		}
	}

	static void fillLine(ThreeByThreeGrid grid, String[][] line, String mark) {
		for (String[] space : line) {
			grid.changeBox(space[0], Integer.valueOf(space[1]), mark);
		}
	}

	static String describe(String[][] line) {
		return line[0][0] + line[0][1] + "-" + line[1][0] + line[1][1] + "-" + line[2][0] + line[2][1];
	}

	public static void newGrid_isEmpty() {
		ThreeByThreeGrid grid = new ThreeByThreeGrid();

		for (String abc : COLUMNS) {
			for (int num = 1; num <= 3; num++) {
				check("new grid: " + abc + num + " is free", grid.checkSpace(abc, num) == false);
			}
		}
		check("new grid: not full", grid.checkIfGridFull() == false);
		check("new grid: no three X", grid.checkIfThreeXInARow() == false);
		check("new grid: no three O", grid.checkIfThreeOInARow() == false);
	}

	public static void changeBox_writesOnlyTheNamedSpace() {
		for (String target : COLUMNS) {
			for (int targetNum = 1; targetNum <= 3; targetNum++) {
				ThreeByThreeGrid grid = new ThreeByThreeGrid();
				grid.changeBox(target, targetNum, "X");

				for (String abc : COLUMNS) {
					for (int num = 1; num <= 3; num++) {
						boolean expected = abc.equals(target) && num == targetNum;
						check("after X at " + target + targetNum + ": " + abc + num + " taken is " + expected, grid.checkSpace(abc, num) == expected);
					}
				}
			}
		}
	}

	public static void changeBox_mapsColumnToSecondIndexAndRowToFirst() {
		ThreeByThreeGrid grid = new ThreeByThreeGrid();
		grid.changeBox("c", 1, "X");
		grid.changeBox("a", 3, "O");

		check("c1 is grid[0][2]", "X".equals(grid.grid[0][2]));
		check("a3 is grid[2][0]", "O".equals(grid.grid[2][0]));
	}

	public static void checkIfThreeXInARow_everyLine() {
		for (String[][] line : LINES) {
			ThreeByThreeGrid grid = new ThreeByThreeGrid();
			fillLine(grid, line, "X");
			check("three X on " + describe(line), grid.checkIfThreeXInARow() == true);
		}
	}

	public static void checkIfThreeOInARow_everyLine() {
		for (String[][] line : LINES) {
			ThreeByThreeGrid grid = new ThreeByThreeGrid();
			fillLine(grid, line, "O");
			check("three O on " + describe(line), grid.checkIfThreeOInARow() == true);
		}
	}

	public static void winChecks_ignoreTheOtherMark() {
		for (String[][] line : LINES) {
			ThreeByThreeGrid xGrid = new ThreeByThreeGrid();
			fillLine(xGrid, line, "X");
			check("three X on " + describe(line) + " is not three O", xGrid.checkIfThreeOInARow() == false);

			ThreeByThreeGrid oGrid = new ThreeByThreeGrid();
			fillLine(oGrid, line, "O");
			check("three O on " + describe(line) + " is not three X", oGrid.checkIfThreeXInARow() == false);
		}
	}

	public static void winChecks_ignoreMixedLines() {
		for (String[][] line : LINES) {
			ThreeByThreeGrid grid = new ThreeByThreeGrid();
			grid.changeBox(line[0][0], Integer.valueOf(line[0][1]), "X");
			grid.changeBox(line[1][0], Integer.valueOf(line[1][1]), "X");
			grid.changeBox(line[2][0], Integer.valueOf(line[2][1]), "O");
			check("X X O on " + describe(line) + " is not three X", grid.checkIfThreeXInARow() == false);
			check("X X O on " + describe(line) + " is not three O", grid.checkIfThreeOInARow() == false);
		}
	}

	public static void checkIfThreeInARow_checksTheGivenMark() {
		for (String[][] line : LINES) {
			ThreeByThreeGrid grid = new ThreeByThreeGrid();
			fillLine(grid, line, "X");
			check("checkIfThreeInARow(\"X\") on " + describe(line), grid.checkIfThreeInARow("X") == true);
			check("checkIfThreeInARow(\"O\") on X " + describe(line) + " is false", grid.checkIfThreeInARow("O") == false);
		}
	}

	public static void checkIfGridFull_onlyWhenNoSpaceIsLeft() {
		// a drawn board, filled in this order, with no line of three for either side:
		//   X O X
		//   X O O
		//   O X X
		String[] moves = {"a1", "b1", "c1", "a2", "b2", "c2", "b3", "a3", "c3"};
		String[] marks = {"X", "O", "X", "X", "O", "O", "X", "O", "X"};
		ThreeByThreeGrid grid = new ThreeByThreeGrid();

		for (int k = 0; k < moves.length; k++) {
			check("not full before " + moves[k], grid.checkIfGridFull() == false);
			grid.changeBox(moves[k].substring(0, 1), Integer.valueOf(moves[k].substring(1, 2)), marks[k]);
		}
		check("full after nine moves", grid.checkIfGridFull() == true);
		check("drawn board: no three X", grid.checkIfThreeXInARow() == false);
		check("drawn board: no three O", grid.checkIfThreeOInARow() == false);
	}

	public static void columnIndex_mapsEachLetterToItsColumn() {
		ThreeByThreeGrid grid = new ThreeByThreeGrid();

		check("columnIndex(\"a\") is 0", grid.columnIndex("a") == 0);
		check("columnIndex(\"b\") is 1", grid.columnIndex("b") == 1);
		check("columnIndex(\"c\") is 2", grid.columnIndex("c") == 2);
		check("columnIndex(\"z\") is 0", grid.columnIndex("z") == 0);
	}

	public static void unknownColumn_isTreatedAsColumnA() {
		// characterizes current behavior: columnIndex, used by both checkSpace and changeBox,
		// falls back to column a for any other column string. playerMove() lower-cases
		// and validates the move first, so the game never passes one in.
		ThreeByThreeGrid grid = new ThreeByThreeGrid();
		grid.changeBox("A", 2, "X");

		check("changeBox(\"A\", 2) writes a2", "X".equals(grid.grid[1][0]));
		check("checkSpace(\"z\", 2) reads a2", grid.checkSpace("z", 2) == true);
		check("checkSpace(\"z\", 1) reads a1", grid.checkSpace("z", 1) == false);
	}

}

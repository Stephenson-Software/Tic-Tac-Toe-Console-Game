
public class ThreeByThreeGrid {
	String[][] grid = new String[3][3];
	
	public ThreeByThreeGrid() { //constructor fills in the grid MD array with " "
		for (int i = 0; i < 3; i++) {
			for (int j = 0; j < 3; j++) {
				grid[i][j] = " ";
			}
		}
	}
	
	public void printGrid() { // prints the grid in a user friendly way
		System.out.println("\n   A   B   C");
		System.out.println("1 [" + grid[0][0] + "] [" + grid[0][1] + "] [" + grid[0][2] + "]");
		System.out.println("2 [" + grid[1][0] + "] [" + grid[1][1] + "] [" + grid[1][2] + "]");
		System.out.println("3 [" + grid[2][0] + "] [" + grid[2][1] + "] [" + grid[2][2] + "]\n");
	}
	
	public boolean checkIfGridFull() { //checks if the grid is full
		boolean full = true;
		
		for (int i = 0; i < 3; i++) {
			for (int j = 0; j < 3; j++) {
				if (" ".equals(grid[i][j])) {
					full = false;
				}
			}
		}
		
		return full;
	}
	
	public boolean checkIfThreeXInARow() {
		boolean threeXInRow = false;
		
		for (int i = 0; i < 3; i++) {
			if (grid[i][0].equals("X") && grid[i][1].equals("X") && grid[i][2].equals("X")) {
				threeXInRow = true;
			}
		}
		
		for (int j = 0; j < 3; j++) {
			if (grid[0][j].equals("X") && grid[1][j].equals("X") && grid[2][j].equals("X")) {
				threeXInRow = true;
			}
		}
		
		if (grid[0][0].equals("X") && grid[1][1].equals("X") && grid[2][2].equals("X")) {
			threeXInRow = true;
		}
		
		if (grid[0][2].equals("X") && grid[1][1].equals("X") && grid[2][0].equals("X")) {
			threeXInRow = true;
		}
		
		return threeXInRow;
	}
	
	public boolean checkIfThreeOInARow() {
		boolean threeOInRow = false;
		
		for (int i = 0; i < 3; i++) {
			if (grid[i][0].equals("O") && grid[i][1].equals("O") && grid[i][2].equals("O")) {
				threeOInRow = true;
			}
		}
		
		for (int j = 0; j < 3; j++) {
			if (grid[0][j].equals("O") && grid[1][j].equals("O") && grid[2][j].equals("O")) {
				threeOInRow = true;
			}
		}
		
		if (grid[0][0].equals("O") && grid[1][1].equals("O") && grid[2][2].equals("O")) {
			threeOInRow = true;
		}
		
		if (grid[0][2].equals("O") && grid[1][1].equals("O") && grid[2][0].equals("O")) {
			threeOInRow = true;
		}
		
		return threeOInRow;
	}
	
	public boolean checkSpace(String abc, int num) { //checks if the space is taken or not and returns true/false
		boolean taken;
		
		int i = 0;
		
		switch(abc) {
			case "a":
				i = 0;
				break;
			case "b":
				i = 1;
				break;
			case "c":
				i = 2;
				break;
		}
				
		int j = num - 1;
		
		if (" ".equals(grid[j][i])) {
			taken = false;
		}
		else {
			taken = true;
		}
		
		return taken;
	}
	
	public void changeBox(String abc, int num, String XorO) { //changes a box (remember to check it first)
		int i = 0;
		
		if (abc.equals("a")) {
			i = 0;
		}
		else if (abc.equals("b")) {
			i = 1;
		}
		else if (abc.equals("c")) {
			i = 2;
		}
		
		int j = num - 1;
		
		grid[j][i] = XorO;
		
	}
	
}
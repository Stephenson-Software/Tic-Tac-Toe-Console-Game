import java.util.Scanner;
import java.util.Random;

public class TicTacToe {
	boolean running = true;
	
	Scanner sc = new Scanner(System.in);
	Random rndm = new Random();
	
	ThreeByThreeGrid theGrid;
	
	public TicTacToe(ThreeByThreeGrid grid) {
		theGrid = grid;
	}
	
	/**
	 * Plays one game to the end.
	 * @return "won", "lost" or "tie"
	 */
	public String play() {
		while (running == true) {
			playerMove();
			
			if (theGrid.checkIfThreeXInARow() == true) {
				theGrid.printGrid();
				System.out.println("You won!");
				return "won";
			}
						
			if (theGrid.checkIfGridFull() == true) {
				theGrid.printGrid();
				System.out.println("It was a tie!");
				return "tie";
			}
						
			computerMove();
			
			if (theGrid.checkIfThreeOInARow() == true) {
				theGrid.printGrid();
				System.out.println("You lost!");
				return "lost";
			}
		}
		return "tie";
	}
	
	
	public void playerMove() {
		theGrid.printGrid();
		System.out.println("Which move would you like to make?");
		
		String move = sc.next();
		String abc = move.substring(0,1);
		int num = Integer.valueOf(move.substring(1, 2));
		
		if (theGrid.checkSpace(abc, num) == false) {
			theGrid.changeBox(abc,  num, "X");
		}
		else {
			System.out.println("That space is taken! Choose another one.");
			playerMove();
		}
	}
	
	public void computerMove() {
		
		String[] letters = {"a", "b", "c"};
		String abc = letters[rndm.nextInt(3)];
		int num = rndm.nextInt(3) + 1;
		
		if (theGrid.checkSpace(abc, num) == false) {
			theGrid.changeBox(abc, num, "O");
		}
		else {
			computerMove();
		}
	}
	
}

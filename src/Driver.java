
public class Driver {

	public static void main(String[] args) {
		
		UsageReporting usageReporting = new UsageReporting();
		usageReporting.start();
		
		try {
			ThreeByThreeGrid myGrid = new ThreeByThreeGrid();
			
			TicTacToe theGame = new TicTacToe(myGrid);
			
			usageReporting.gameFinished(theGame.play());
		}
		finally {
			usageReporting.close();
		}

	}

}
 

public class Driver {

	public static void main(String[] args) {
		
		UsageReporting usageReporting = new UsageReporting();
		usageReporting.start();
		
		try {
			ThreeByThreeGrid myGrid = new ThreeByThreeGrid();
			
			TicTacToe theGame = new TicTacToe(myGrid);
			
			String result = theGame.play();
			
			// null means input ended before the game finished, so there is no result to report
			if (result != null) {
				usageReporting.gameFinished(result);
			}
		}
		finally {
			usageReporting.close();
		}

	}

}
 
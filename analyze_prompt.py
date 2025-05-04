from classifier.jailbreak_detector import JailbreakDetector, display_results
from rich.console import Console
from rich.panel import Panel
import logging
import torch
from dotenv import load_dotenv
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def main():
    # Load environment variables
    load_dotenv()
    
    # Check if GEMINI_API_KEY is set
    if not os.getenv('GEMINI_API_KEY'):
        print("Error: GEMINI_API_KEY not found in .env file")
        return
        
    console = Console()
    
    # Use CPU for processing
    device = torch.device('cpu')
    logging.info(f"Using device: {device}")
    
    try:
        # Initialize detector
        detector = JailbreakDetector(
            model_name="distilbert-base-uncased",  # Using default model for now
            max_history=10,
            device=device
        )
        
        console.print(Panel.fit(
            "[bold blue]Jailbreak Detection Interactive Analysis[/bold blue]\n"
            "[yellow]Enter 'quit' to exit[/yellow]",
            border_style="blue"
        ))
        
        while True:
            # Get user input
            prompt = console.input("\n[bold green]Enter your prompt to analyze:[/bold green] ")
            
            if prompt.lower() == 'quit':
                break
                
            if not prompt:
                continue
            
            # Analyze the prompt
            result = detector.predict(prompt)
            
            # Display results
            display_results(result, console)
            
    except KeyboardInterrupt:
        console.print("\n[yellow]Exiting...[/yellow]")
    except Exception as e:
        console.print(f"\n[red]Error:[/red] {str(e)}")
        logging.error(f"Error: {e}", exc_info=True)

if __name__ == "__main__":
    main() 
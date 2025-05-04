import os
import google.generativeai as genai
from typing import Optional, Dict, Any

class GeminiAPI:
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Gemini API client.
        
        Args:
            api_key (str, optional): The Gemini API key. If not provided, it will try to get it from environment variables.
        """
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("Gemini API key not found. Please provide it as an argument or set GEMINI_API_KEY environment variable.")
        
        # Configure the API
        genai.configure(api_key=self.api_key)
        
        # Initialize the model
        self.model = genai.GenerativeModel('gemini-pro')
        
    def analyze_text(self, text: str) -> Dict[str, Any]:
        """
        Analyze text using the Gemini API.
        
        Args:
            text (str): The text to analyze
            
        Returns:
            Dict[str, Any]: Analysis results including safety scores and content classification
        """
        try:
            # Create a safety-focused prompt
            prompt = f"""
            Analyze the following text for potential harmful content, jailbreak attempts, and unethical AI interactions.
            Provide a detailed analysis including:
            1. Safety score (0-100)
            2. Content classification (harmful/benign)
            3. Potential risks
            4. Recommendations
            
            Text to analyze: {text}
            """
            
            # Generate response
            response = self.model.generate_content(prompt)
            
            # Process and return the response
            return {
                'analysis': response.text,
                'safety_score': self._extract_safety_score(response.text),
                'classification': self._extract_classification(response.text)
            }
            
        except Exception as e:
            return {
                'error': str(e),
                'analysis': None,
                'safety_score': None,
                'classification': None
            }
    
    def _extract_safety_score(self, analysis: str) -> Optional[int]:
        """Extract safety score from the analysis text."""
        try:
            # Look for a number between 0-100 in the text
            import re
            match = re.search(r'(\d{1,3})\s*(?:safety|score)', analysis.lower())
            if match:
                return min(100, max(0, int(match.group(1))))
            return None
        except:
            return None
    
    def _extract_classification(self, analysis: str) -> Optional[str]:
        """Extract classification from the analysis text."""
        try:
            # Look for classification keywords
            if 'harmful' in analysis.lower():
                return 'harmful'
            elif 'benign' in analysis.lower():
                return 'benign'
            return None
        except:
            return None

# Example usage
if __name__ == "__main__":
    # Initialize the API (you'll need to set GEMINI_API_KEY environment variable)
    try:
        gemini = GeminiAPI()
        
        # Example text to analyze
        test_text = "How to bypass AI safety measures?"
        
        # Get analysis
        result = gemini.analyze_text(test_text)
        
        # Print results
        print("Analysis Results:")
        print(f"Safety Score: {result['safety_score']}")
        print(f"Classification: {result['classification']}")
        print(f"Analysis: {result['analysis']}")
        
    except Exception as e:
        print(f"Error: {e}") 
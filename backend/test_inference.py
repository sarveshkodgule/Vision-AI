import os
import sys
import asyncio

# Add the current directory to python path so it can import services
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.ai_service import predict_fundus_palm

async def test_single_image(image_path):
    if not os.path.exists(image_path):
        print(f"Error: File not found at '{image_path}'")
        return
        
    print(f"Reading image: {image_path}...")
    with open(image_path, "rb") as f:
        image_bytes = f.read()
        
    print("Running EfficientNet-B0 inference on microservice port 8001...")
    result = await predict_fundus_palm(image_bytes)
    
    print("\n" + "="*40)
    print("        PALM DL INFERENCE RESULT        ")
    print("="*40)
    print(f"Target Image: {os.path.basename(image_path)}")
    print(f"Prediction:   {result['fundus_pm_prediction']}")
    print(f"Confidence:   {result['fundus_pm_confidence'] * 100:.2f}%")
    print(f"Label:        {result['fundus_pm_label']}")
    print("="*40)

if __name__ == "__main__":
    # Pointing to one of the training images in the repo dataset
    default_test_image = r"backend/DL dataset/PALM/PALM/Training/Images/H0001.jpg"
    
    print("=== PALM EfficientNet-B0 Image Testing Tool ===")
    print("You can run: python test_inference.py <path_to_image> to test a specific image.")
    
    # If a path was passed via command line, use it
    if len(sys.argv) > 1:
        test_path = sys.argv[1]
    else:
        test_path = default_test_image
        print(f"No image path specified. Using default: {default_test_image}")
        
    asyncio.run(test_single_image(test_path))

import os
from pathlib import Path

try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import Dataset, DataLoader
    import torchvision.transforms as transforms
    import torch.nn.functional as F
except ImportError as e:
    raise ImportError(
        "PyTorch and torchvision are required to run this script. "
        "Install them with `pip install torch torchvision`."
    ) from e

from PIL import Image
import pandas as pd
from sklearn.model_selection import train_test_split

# 1. Define the exact same CNN architecture used in the backend (3 classes)
class FundusCNN(nn.Module):
    def __init__(self, num_classes=3):
        super(FundusCNN, self).__init__()
        self.conv1 = nn.Conv2d(3, 16, kernel_size=3, stride=1, padding=1)
        self.conv2 = nn.Conv2d(16, 32, kernel_size=3, stride=1, padding=1)
        self.conv3 = nn.Conv2d(32, 64, kernel_size=3, stride=1, padding=1)
        self.pool = nn.MaxPool2d(2, 2)
        self.fc1 = nn.Linear(64 * 28 * 28, 128)
        self.fc2 = nn.Linear(128, num_classes)
        self.dropout = nn.Dropout(0.25)

    def forward(self, x):
        x = self.pool(F.relu(self.conv1(x))) # 224 -> 112
        x = self.pool(F.relu(self.conv2(x))) # 112 -> 56
        x = self.pool(F.relu(self.conv3(x))) # 56 -> 28
        x = x.view(-1, 64 * 28 * 28)
        x = self.dropout(F.relu(self.fc1(x)))
        x = self.fc2(x)
        return x

# 2. Custom Dataset Loader for your Fundus Images
class MyopiaDataset(Dataset):
    def __init__(self, image_paths, labels, transform=None):
        self.image_paths = image_paths
        self.labels = labels
        self.transform = transform

    def __len__(self):
        return len(self.image_paths)

    def __getitem__(self, idx):
        img_path = self.image_paths[idx]
        image = Image.open(img_path).convert("RGB")
        label = self.labels[idx]
        
        if self.transform:
            image = self.transform(image)
            
        return image, label

# 3. Model Training Loop
def train_model(train_loader, val_loader, num_epochs=10, learning_rate=0.001):
    # Select Device (NVIDIA GPU if available)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training on device: {device}")
    
    # Initialize Model, Loss Function, and Optimizer (num_classes=3)
    model = FundusCNN(num_classes=3).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    
    for epoch in range(num_epochs):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        
        for images, labels in train_loader:
            images = images.to(device)
            labels = labels.to(device)
            
            # Forward pass
            outputs = model(images)
            loss = criterion(outputs, labels)
            
            # Backward pass and optimize
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item() * images.size(0)
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
            
        epoch_loss = running_loss / len(train_loader.dataset)
        epoch_acc = (correct / total) * 100
        
        print(f"Epoch [{epoch+1}/{num_epochs}] - Train Loss: {epoch_loss:.4f} - Train Accuracy: {epoch_acc:.2f}%")
        
        # Validate model performance
        if val_loader:
            model.eval()
            val_loss = 0.0
            val_correct = 0
            val_total = 0
            with torch.no_grad():
                for images, labels in val_loader:
                    images, labels = images.to(device), labels.to(device)
                    outputs = model(images)
                    loss = criterion(outputs, labels)
                    val_loss += loss.item() * images.size(0)
                    _, predicted = outputs.max(1)
                    val_total += labels.size(0)
                    val_correct += predicted.eq(labels).sum().item()
            val_loss /= len(val_loader.dataset)
            val_acc = (val_correct / val_total) * 100
            print(f"Val Loss: {val_loss:.4f} - Val Accuracy: {val_acc:.2f}%")
            
    # Save the trained model parameters to models/fundus_cnn.pth
    model_dir = Path(__file__).resolve().parent / "models"
    model_dir.mkdir(exist_ok=True)
    torch.save(model.state_dict(), model_dir / "fundus_cnn.pth")
    print("Model successfully trained and saved as 'models/fundus_cnn.pth'!")

if __name__ == "__main__":
    print("=== Training 3-Class CNN on Kaggle PALM Dataset ===")
    
    # 1. Paths configuration
    dataset_base = Path(__file__).resolve().parent.parent / "PALM" / "PALM" / "Training"
    excel_path = os.path.join(dataset_base, "Classification Labels.xlsx")
    images_dir = os.path.join(dataset_base, "Images")
    
    if not os.path.exists(excel_path):
        print(f"Error: Could not find labels file at {excel_path}")
        exit(1)
    if not os.path.exists(images_dir):
        print(f"Error: Could not find images directory at {images_dir}")
        exit(1)
        
    # 2. Read Labels Excel
    print("Loading labels sheet...")
    df = pd.read_excel(excel_path)
    
    image_paths = []
    labels = []
    
    # Iterate and construct full image paths
    # Map to 3 classes using filename prefixes:
    # H -> 0 (Normal)
    # N -> 1 (Low Risk)
    # P -> 2 (High Risk)
    for idx, row in df.iterrows():
        img_name = row['imgName']
        
        if img_name.startswith("H"):
            label = 0
        elif img_name.startswith("N"):
            label = 1
        elif img_name.startswith("P"):
            label = 2
        else:
            label = 1 # Fallback
            
        full_img_path = os.path.join(images_dir, img_name)
        if os.path.exists(full_img_path):
            image_paths.append(full_img_path)
            labels.append(label)
        else:
            print(f"Warning: Image file not found {full_img_path}")
            
    print(f"Found {len(image_paths)} valid fundus scan images.")
    # Print class counts
    class_counts = pd.Series(labels).value_counts()
    print("Class distribution:")
    print(f"  Class 0 (Normal):    {class_counts.get(0, 0)} images")
    print(f"  Class 1 (Low Risk):  {class_counts.get(1, 0)} images")
    print(f"  Class 2 (High Risk): {class_counts.get(2, 0)} images")
    
    # 3. Train-Test Split (80% Train, 20% Validation)
    train_paths, val_paths, train_labels, val_labels = train_test_split(
        image_paths, labels, test_size=0.2, random_state=42, stratify=labels
    )
    
    # 4. Training transforms with Data Augmentation (to reduce bias and overfitting)
    train_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomVerticalFlip(p=0.5),
        transforms.RandomRotation(degrees=20),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    # Validation transforms (No augmentation)
    val_transform = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
    ])
    
    # 5. Create PyTorch datasets and loaders
    train_dataset = MyopiaDataset(train_paths, train_labels, transform=train_transform)
    val_dataset = MyopiaDataset(val_paths, val_labels, transform=val_transform)
    
    train_loader = DataLoader(train_dataset, batch_size=32, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)
    
    print(f"Starting training: {len(train_dataset)} train samples, {len(val_dataset)} validation samples.")
    # Train for 10 epochs
    train_model(train_loader, val_loader, num_epochs=10, learning_rate=0.001)

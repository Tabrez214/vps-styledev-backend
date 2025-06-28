import mongoose from 'mongoose';
import dotenv from 'dotenv';
import ShirtStyle from '../models/design-studio/shirt-style';
import Clipart from '../models/design-studio/clipart';

dotenv.config();

const shirtStyles = [
  { id: "gildan-cotton", name: "Gildan Cotton T-Shirt", price: 5.29, images: { front: "/tshirt-images/Front.jpg", back: "/tshirt-images/Back.jpg", left: "/tshirt-images/Left.jpg", right: "/tshirt-images/Right.jpg" } },
  { id: "premium-cotton", name: "Premium Cotton T-Shirt", price: 8.99, images: { front: "/tshirt-images/Front.jpg", back: "/tshirt-images/Back.jpg", left: "/tshirt-images/Left.jpg", right: "/tshirt-images/Right.jpg" } },
  { id: "vintage-wash", name: "Vintage Wash T-Shirt", price: 12.49, images: { front: "/tshirt-images/Front.jpg", back: "/tshirt-images/Back.jpg", left: "/tshirt-images/Left.jpg", right: "/tshirt-images/Right.jpg" } },
];

const colors = [
  { name: "White", value: "#FFFFFF" },
  { name: "Black", value: "#000000" },
  { name: "Navy", value: "#000080" },
  { name: "Royal Blue", value: "#4169E1" },
  { name: "Red", value: "#FF0000" },
  { name: "Forest Green", value: "#228B22" },
  { name: "Purple", value: "#800080" },
  { name: "Orange", value: "#FFA500" },
  { name: "Yellow", value: "#FFFF00" },
  { name: "Pink", value: "#FFC0CB" },
  { name: "Gray", value: "#808080" },
  { name: "Light Blue", value: "#ADD8E6" },
];

const clipartCategories = {
  animals: [
    { id: "cat", name: "Cat", svg: "🐱" },
    { id: "dog", name: "Dog", svg: "🐶" },
    { id: "lion", name: "Lion", svg: "🦁" },
    { id: "elephant", name: "Elephant", svg: "🐘" },
    { id: "tiger", name: "Tiger", svg: "🐅" },
    { id: "bear", name: "Bear", svg: "🐻" },
  ],
  fruits: [
    { id: "apple", name: "Apple", svg: "🍎" },
    { id: "banana", name: "Banana", svg: "🍌" },
    { id: "orange", name: "Orange", svg: "🍊" },
    { id: "grapes", name: "Grapes", svg: "🍇" },
    { id: "strawberry", name: "Strawberry", svg: "🍓" },
    { id: "pineapple", name: "Pineapple", svg: "🍍" },
  ],
  places: [
    { id: "mountain", name: "Mountain", svg: "🏔️" },
    { id: "beach", name: "Beach", svg: "🏖️" },
    { id: "city", name: "City", svg: "🏙️" },
    { id: "forest", name: "Forest", svg: "🌲" },
    { id: "desert", name: "Desert", svg: "🏜️" },
    { id: "island", name: "Island", svg: "🏝️" },
  ],
  nature: [
    { id: "sun", name: "Sun", svg: "☀️" },
    { id: "moon", name: "Moon", svg: "🌙" },
    { id: "star", name: "Star", svg: "⭐" },
    { id: "flower", name: "Flower", svg: "🌸" },
    { id: "tree", name: "Tree", svg: "🌳" },
    { id: "leaf", name: "Leaf", svg: "🍃" },
  ],
};

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "");

    await ShirtStyle.deleteMany({});
    await Clipart.deleteMany({});

    const shirtStyleData = shirtStyles.map(style => ({ ...style, colors }));
    await ShirtStyle.insertMany(shirtStyleData);

    const clipartData = Object.entries(clipartCategories).flatMap(([category, items]) => 
      items.map(item => ({ ...item, category }))
    );
    await Clipart.insertMany(clipartData);

    console.log('Database seeded successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    mongoose.connection.close();
  }
};

seedDatabase();

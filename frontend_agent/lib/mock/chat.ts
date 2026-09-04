export interface Product {
  id: string;
  thumbnailUrl: string;
  name: string;
  description: string;
  price: number;
  currency: string; // e.g. "INR"
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;        // markdown
  products?: Product[];   // optional — assistant messages may embed product cards
  metadata?: Record<string, any>; // optional — metadata for dynamic chat cards (profile_card, order_history_card, initiate_payment, etc.)
  createdAt: string;      // ISO timestamp
  error?: boolean;        // optional — flag indicating DB save failure
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: "p1",
    thumbnailUrl: "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400&auto=format&fit=crop&q=80",
    name: "Double Cheese Margherita Pizza",
    description: "Classic hand-tossed crust loaded with extra mozzarella cheese and fresh basil leaves.",
    price: 349,
    currency: "INR",
  },
  {
    id: "p2",
    thumbnailUrl: "https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=400&auto=format&fit=crop&q=80",
    name: "Spicy Paneer Tikka Wrap",
    description: "Succulent paneer tikka cubes wrapped in a soft paratha with fresh mint chutney and crisp onions.",
    price: 189,
    currency: "INR",
  },
  {
    id: "p3",
    thumbnailUrl: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=400&auto=format&fit=crop&q=80",
    name: "Choco Lava Cake",
    description: "Decadent warm chocolate cake with a gooey, molten chocolate center. Served hot.",
    price: 129,
    currency: "INR",
  },
  {
    id: "p4",
    thumbnailUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=80",
    name: "Tandoori Chicken Salad",
    description: "Smoky tandoori chicken strips tossed with romaine lettuce, cherry tomatoes, and light vinaigrette.",
    price: 249,
    currency: "INR",
  },
  {
    id: "p5",
    thumbnailUrl: "", // Intentional empty string to test the thumbnail graceful fallback
    name: "Mango Lassi Bliss",
    description: "Thick, creamy yogurt drink blended with fresh sweet mango pulp and cardamom.",
    price: 99,
    currency: "INR",
  }
];

// Helper to generate unique message IDs
const uuidv4 = () => Math.random().toString(36).substring(2, 15);

// Standard responses based on matching user keywords
const getAssistantReply = (userMessage: string): { content: string; products?: Product[] } => {
  const msg = userMessage.toLowerCase();

  if (msg.includes("pizza") || msg.includes("cheese")) {
    return {
      content: "I found some delicious pizza options for you! The **Double Cheese Margherita Pizza** is highly recommended. Would you like me to add it to your order?",
      products: [MOCK_PRODUCTS[0], MOCK_PRODUCTS[2]],
    };
  }

  if (msg.includes("wrap") || msg.includes("paneer")) {
    return {
      content: "Here's our popular **Spicy Paneer Tikka Wrap** which comes with mint chutney. I've also matched it with a refreshing **Mango Lassi** dessert combo!",
      products: [MOCK_PRODUCTS[1], MOCK_PRODUCTS[4]],
    };
  }

  if (msg.includes("dessert") || msg.includes("sweet") || msg.includes("choco") || msg.includes("cake")) {
    return {
      content: "Treat yourself to some sweets! Here is our molten **Choco Lava Cake** and creamy **Mango Lassi Bliss**.",
      products: [MOCK_PRODUCTS[2], MOCK_PRODUCTS[4]],
    };
  }

  if (msg.includes("salad") || msg.includes("chicken") || msg.includes("healthy")) {
    return {
      content: "Looking for something lighter or protein-packed? The **Tandoori Chicken Salad** is freshly prepared and highly rated.",
      products: [MOCK_PRODUCTS[3]],
    };
  }

  if (msg.includes("hello") || msg.includes("hi") || msg.includes("hey")) {
    return {
      content: "Hello! I am your **ShopAgent AI Assistant**. How can I help you order today? You can search for pizzas, wraps, salads, desserts, and more!",
    };
  }

  // Default fallback response offering several items
  return {
    content: "Here are some top picks from our menu that you might love today. Feel free to ask about specific dishes or dietary preferences!",
    products: [MOCK_PRODUCTS[0], MOCK_PRODUCTS[1], MOCK_PRODUCTS[3]],
  };
};

export const mockSendMessage = (
  conversationId: string,
  userMessage: string
): Promise<ChatMessage> => {
  return new Promise((resolve) => {
    const delay = Math.random() * (1200 - 600) + 600; // randomized delay between 600ms and 1200ms
    setTimeout(() => {
      const reply = getAssistantReply(userMessage);
      resolve({
        id: uuidv4(),
        role: "assistant",
        content: reply.content,
        products: reply.products,
        createdAt: new Date().toISOString(),
      });
    }, delay);
  });
};

export const mockGetConversationHistory = (conversationId: string): Promise<ChatMessage[]> => {
  return new Promise((resolve) => {
    // If the conversationId is "returning-user", return a small test history
    if (conversationId === "returning-user") {
      resolve([
        {
          id: "m1",
          role: "user",
          content: "I want to get a wrap and a drink please.",
          createdAt: new Date(Date.now() - 60000).toISOString(),
        },
        {
          id: "m2",
          role: "assistant",
          content: "Sure! I highly recommend our wrap and sweet beverage options:",
          products: [MOCK_PRODUCTS[1], MOCK_PRODUCTS[4]],
          createdAt: new Date(Date.now() - 30000).toISOString(),
        }
      ]);
    }
    // Default to an empty array for normal/new chats
    resolve([]);
  });
};

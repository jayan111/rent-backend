import { Request, Response } from 'express';

export const getHomeContent = async (req: Request, res: Response) => {
  try {
    const homeContent = {
      hero: {
        title: "Rent Premium Products in India",
        subtitle: "From electronics to furniture - rent what you need, when you need it",
        ctaText: "Start Renting",
        backgroundImage: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1200&h=600&fit=crop"
      },
      offers: [
        {
          id: 1,
          title: "50% OFF Electronics",
          description: "Get amazing discounts on laptops, phones, and gadgets",
          discount: "50%",
          image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?w=800&h=400&fit=crop",
          code: "TECH50"
        },
        {
          id: 2,
          title: "Furniture Flash Sale",
          description: "Premium furniture rentals at unbeatable prices",
          discount: "35%",
          image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&h=400&fit=crop",
          code: "FURNITURE35"
        },
        {
          id: 3,
          title: "Vehicle Weekend Deal",
          description: "Rent cars and bikes for your weekend adventures",
          discount: "25%",
          image: "https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=800&h=400&fit=crop",
          code: "WEEKEND25"
        }
      ],
      reviews: [
        {
          id: 1,
          name: "Priya Sharma",
          rating: 5,
          comment: "Amazing service! Rented a MacBook for my project and it was in perfect condition. Delivery was super fast in Mumbai!",
          avatar: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=100&h=100&fit=crop&crop=face",
          location: "Mumbai"
        },
        {
          id: 2,
          name: "Rahul Kumar",
          rating: 5,
          comment: "Great experience renting furniture for my new apartment in Bangalore. Everything was clean and exactly as described.",
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
          location: "Bangalore"
        },
        {
          id: 3,
          name: "Sneha Patel",
          rating: 4,
          comment: "Rented a camera for my wedding in Delhi. Quality was excellent and the rental process was so smooth!",
          avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
          location: "Delhi"
        },
        {
          id: 4,
          name: "Arjun Singh",
          rating: 5,
          comment: "Perfect for short-term needs in Pune. Saved me thousands compared to buying. Highly recommend!",
          avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
          location: "Pune"
        }
      ],
      features: {
        delivery: {
          title: "Free Delivery",
          description: "Within 15 km",
          icon: "truck"
        },
        insurance: {
          title: "Fully Insured",
          description: "Complete protection",
          icon: "shield"
        },
        support: {
          title: "24/7 Support",
          description: "Always here to help",
          icon: "headphones"
        }
      },
      currency: "₹",
      deliveryRadius: "15 km",
      country: "India"
    };

    res.json({ data: homeContent });
  } catch (error) {
    console.error('Get home content error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAppSettings = async (req: Request, res: Response) => {
  try {
    const settings = {
      currency: "₹",
      deliveryRadius: "15 km",
      country: "India",
      supportPhone: "+91-9876543210",
      supportEmail: "support@rentyourneeds.in",
      cities: ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Pune", "Kolkata", "Ahmedabad"],
      paymentMethods: ["UPI", "Credit Card", "Debit Card", "Net Banking", "Wallet"],
      languages: ["English", "Hindi"]
    };

    res.json({ data: settings });
  } catch (error) {
    console.error('Get app settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
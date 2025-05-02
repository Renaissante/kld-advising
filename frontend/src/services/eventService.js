// Simple event bus for cross-component communication

class EventService {
  constructor() {
    this.events = {};
    console.log("EventService initialized");
  }

  // Subscribe to an event
  on(eventName, callback) {
    if (!this.events[eventName]) {
      this.events[eventName] = [];
    }
    this.events[eventName].push(callback);
    console.log(`Subscribed to ${eventName}, total listeners: ${this.events[eventName].length}`);
    
    // Return unsubscribe function
    return () => {
      this.events[eventName] = this.events[eventName].filter(
        cb => cb !== callback
      );
      console.log(`Unsubscribed from ${eventName}, remaining listeners: ${this.events[eventName]?.length || 0}`);
    };
  }

  // Emit an event
  emit(eventName, data) {
    console.log(`Emitting event: ${eventName}`, data);
    if (this.events[eventName]) {
      console.log(`Found ${this.events[eventName].length} listeners for ${eventName}`);
      this.events[eventName].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${eventName} event handler:`, error);
        }
      });
    } else {
      console.warn(`No listeners for event: ${eventName}`);
    }
  }
}

// Create a singleton instance
const eventService = new EventService();

export default eventService; 
/**
 * Earth Watcher — Data Manager
 * Veri yükleme, filtreleme ve zaman yönetimi
 */

class DataManager {
  constructor() {
    this.events = [];
    this.filteredEvents = [];
    this.currentCategory = null;
    this.currentDateRange = { start: null, end: null };
    this.loaded = false;
  }

  /**
   * events.json dosyasından verileri yükle
   */
  async load() {
    try {
      const response = await fetch("data/events.json");
      const data = await response.json();

      // Tarihe göre sırala
      this.events = data.events.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      );

      this.filteredEvents = [...this.events];
      this.loaded = true;

      console.log(`📦 Data Manager: ${this.events.length} olay yüklendi`);
      return this.events;
    } catch (error) {
      console.error("❌ Data Manager: Veri yüklenemedi:", error);
      return [];
    }
  }

  /**
   * Olayları kategorisine göre filtrele
   */
  filterByCategory(category) {
    this.currentCategory = category;

    if (!category || category === "tum") {
      this.filteredEvents = [...this.events];
    } else {
      this.filteredEvents = this.events.filter((e) => e.category === category);
    }

    return this.filteredEvents;
  }

  /**
   * Tüm kategorileri döndür
   */
  getCategories() {
    const categories = [...new Set(this.events.map((e) => e.category))];
    return categories.sort();
  }

  /**
   * Belirtilen kategorideki olay sayısını döndür
   */
  getCountByCategory(category) {
    return this.events.filter((e) => e.category === category).length;
  }

  /**
   * Şiddet seviyesine göre filtrele
   */
  filterBySeverity(severity) {
    const levels = ["low", "medium", "high", "critical"];
    const minLevel = levels.indexOf(severity);

    this.filteredEvents = this.events.filter(
      (e) => levels.indexOf(e.severity) >= minLevel,
    );

    return this.filteredEvents;
  }

  /**
   * Tarih aralığına göre filtrele
   */
  filterByDateRange(startDate, endDate) {
    this.currentDateRange = { start: startDate, end: endDate };

    this.filteredEvents = this.events.filter((e) => {
      const eventDate = new Date(e.timestamp);
      return (
        (!startDate || eventDate >= new Date(startDate)) &&
        (!endDate || eventDate <= new Date(endDate))
      );
    });

    return this.filteredEvents;
  }

  /**
   * Bir olayın detayını ID ile getir
   */
  getEventById(id) {
    return this.events.find((e) => e.id === id);
  }

  /**
   * Olayları harita üzerinde göstermek için GeoJSON formatına dönüştür
   */
  toGeoJSON(events = null) {
    const data = events || this.filteredEvents;

    return {
      type: "FeatureCollection",
      features: data.map((event) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [event.lng, event.lat],
        },
        properties: {
          id: event.id,
          title: event.title,
          category: event.category,
          subcategory: event.subcategory,
          severity: event.severity,
          description: event.description,
          timestamp: event.timestamp,
          source: event.source,
        },
      })),
    };
  }

  /**
   * Tüm filtreleri sıfırla
   */
  resetFilters() {
    this.currentCategory = null;
    this.currentDateRange = { start: null, end: null };
    this.filteredEvents = [...this.events];
    return this.filteredEvents;
  }

  /**
   * Olayları özet bilgisiyle döndür
   */
  getSummary() {
    return {
      total: this.events.length,
      categories: this.getCategories().map((cat) => ({
        name: cat,
        count: this.getCountByCategory(cat),
      })),
      filtered: this.filteredEvents.length,
      loaded: this.loaded,
    };
  }
}

// Global değişkene ata
window.dataManager = new DataManager();

import { useState, useEffect } from "react";
import "@/App.css";
import axios from "axios";
import { Search, Home, Mail, TrendingUp, DollarSign, Bed, MapPin, ExternalLink, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function App() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  
  const cities = [
    "Affton",
    "Ballwin",
    "Bella Villa",
    "Brentwood",
    "Clayton",
    "Concord",
    "Crestwood",
    "Des Peres",
    "Florissant",
    "Frontenac",
    "Glendale",
    "Grantwood Village",
    "Hillsdale",
    "Huntleigh",
    "Kirkwood",
    "Lakeshire",
    "Lemay",
    "Manchester",
    "Maplewood",
    "Marlborough",
    "Maryland Heights",
    "Mehlville",
    "Oakland",
    "Olivette",
    "Overland",
    "Richmond Heights",
    "Rock Hill",
    "Sappington",
    "Shrewsbury",
    "Southwest Garden",
    "St. Ann",
    "The Hill",
    "University City",
    "Velda City",
    "Warson Woods",
    "Webster Groves",
    "St. Charles"
  ];
  
  // Search filters
  const [selectedCities, setSelectedCities] = useState(["Lemay", "Florissant", "St. Ann", "The Hill", "Affton", "Bella Villa"]);
  const [minPrice, setMinPrice] = useState(100000);
  const [maxPrice, setMaxPrice] = useState(250000);
  const [minBedrooms, setMinBedrooms] = useState(2);
  const [maxBedrooms, setMaxBedrooms] = useState(3);
  const [propertyType, setPropertyType] = useState("single_family");
  const [minCapRate, setMinCapRate] = useState(7);
  const [requiresGarage, setRequiresGarage] = useState(true);
  const [excludeDamagedNearby, setExcludeDamagedNearby] = useState(true);
  const [excludeVacantNearby, setExcludeVacantNearby] = useState(true);
  const [selectedHomeStyles, setSelectedHomeStyles] = useState([]);
  
  // For inline editing
  const [editingProperty, setEditingProperty] = useState(null);
  const [editingField, setEditingField] = useState(null);
  
  // Email preferences
  const [email, setEmail] = useState("");
  const [emailMinCapRate, setEmailMinCapRate] = useState(6);
  const [emailMinROI, setEmailMinROI] = useState(8);
  const [dayOfWeek, setDayOfWeek] = useState("monday");
  const [emailEnabled, setEmailEnabled] = useState(true);
  
  const homeStyles = [
    { value: "ranch", label: "Ranch" },
    { value: "colonial", label: "Colonial" },
    { value: "victorian", label: "Victorian" },
    { value: "bungalow", label: "Bungalow" },
    { value: "cape_cod", label: "Cape Cod" },
    { value: "split_level", label: "Split Level" },
    { value: "contemporary", label: "Contemporary" },
    { value: "tudor", label: "Tudor" },
    { value: "craftsman", label: "Craftsman" }
  ];
  
  useEffect(() => {
    loadSavedProperties();
  }, []);
  
  const loadSavedProperties = async () => {
    try {
      const response = await axios.get(`${API}/properties?limit=20`);
      setProperties(response.data);
    } catch (error) {
      console.error("Error loading properties:", error);
    }
  };
  
  const searchProperties = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/properties/search`, {
        cities: selectedCities,
        min_price: minPrice,
        max_price: maxPrice,
        min_bedrooms: minBedrooms,
        max_bedrooms: maxBedrooms,
        property_types: propertyType === "both" ? ["single_family", "multi_family"] : [propertyType],
        home_styles: selectedHomeStyles.length > 0 ? selectedHomeStyles : null,
        min_cap_rate: minCapRate / 100,
        requires_garage: requiresGarage,
        max_nearby_vacant_days: 100,
        exclude_damaged_nearby: excludeDamagedNearby,
        limit: 50
      });
      
      setProperties(response.data);
      toast.success(`Found ${response.data.length} properties!`);
    } catch (error) {
      console.error("Error searching properties:", error);
      toast.error("Error searching properties. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const saveEmailPreferences = async () => {
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    
    try {
      await axios.post(`${API}/email-preferences`, {
        email,
        min_cap_rate: emailMinCapRate / 100,
        min_roi: emailMinROI / 100,
        day_of_week: dayOfWeek,
        enabled: emailEnabled
      });
      
      toast.success("Email preferences saved! You'll receive weekly property updates.");
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast.error("Error saving preferences. Please try again.");
    }
  };
  
  const sendTestEmail = async () => {
    if (!email) {
      toast.error("Please enter your email address");
      return;
    }
    
    try {
      await axios.post(`${API}/test-email?email=${email}`);
      toast.success("Test email sent! Check your inbox.");
    } catch (error) {
      console.error("Error sending test email:", error);
      toast.error("Error sending test email. Please try again.");
    }
  };
  
  const toggleCity = (city) => {
    setSelectedCities(prev => 
      prev.includes(city) ? prev.filter(c => c !== city) : [...prev, city]
    );
  };
  
  const recalculateProperty = (property, newMonthlyRent) => {
    // Recalculate cap rate and ROI with new rent
    const annualGrossRent = newMonthlyRent * 12;
    const vacancyLoss = annualGrossRent * 0.04; // 4% vacancy rate
    const effectiveGrossIncome = annualGrossRent - vacancyLoss;
    
    // Operating expenses
    const propertyTax = property.property_tax || property.price * 0.018;
    const insurance = property.insurance || 1000;
    const utilities = 500;
    const repair = effectiveGrossIncome * 0.10;
    const maintenance = effectiveGrossIncome * 0.03;
    const totalOperatingExpenses = propertyTax + insurance + utilities + repair + maintenance;
    
    // NOI
    const noi = effectiveGrossIncome - totalOperatingExpenses;
    
    // Cap Rate
    const capRate = (noi / property.price) * 100;
    
    // Financing
    const downPayment = property.price * 0.20;
    const loanAmount = property.price * 0.80;
    const monthlyRate = 0.07 / 12;
    const numPayments = 30 * 12;
    const monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / (Math.pow(1 + monthlyRate, numPayments) - 1);
    const annualDebtService = monthlyPayment * 12;
    
    // Cash Flow and ROI
    const annualCashFlow = noi - annualDebtService;
    const roi = (annualCashFlow / downPayment) * 100;
    
    return {
      ...property,
      monthly_rent: newMonthlyRent,
      cap_rate: capRate,
      roi: roi,
      annual_cash_flow: annualCashFlow,
      noi: noi,
      property_tax: propertyTax,
      insurance: insurance
    };
  };
  
  const updatePropertyRent = (zpid, newRent) => {
    updatePropertyField(zpid, 'monthly_rent', newRent);
  };
  
  const updatePropertyField = async (zpid, field, value) => {
    try {
      const updates = { [field]: parseFloat(value) };
      const response = await axios.patch(`${API}/properties/${zpid}`, updates);
      
      setProperties(prev => prev.map(prop => 
        prop.zpid === zpid ? response.data : prop
      ));
      
      setEditingProperty(null);
      setEditingField(null);
      toast.success("Property updated & recalculated!");
    } catch (error) {
      console.error("Error updating property:", error);
      toast.error("Failed to update property");
    }
  };
  
  return (
    <div className="App">
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg">
                  <Home className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-slate-900" style={{fontFamily: 'Space Grotesk, sans-serif'}}>STL Property Analyzer</h1>
                  <p className="text-sm text-slate-600">Find Your Next Investment Property</p>
                </div>
              </div>
              <Badge variant="secondary" className="hidden sm:flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Cap Rate Analysis
              </Badge>
            </div>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-3 bg-white/60 backdrop-blur-sm" data-testid="main-tabs">
              <TabsTrigger value="search" className="gap-2" data-testid="search-tab">
                <Search className="h-4 w-4" />
                Search
              </TabsTrigger>
              <TabsTrigger value="properties" className="gap-2" data-testid="properties-tab">
                <Home className="h-4 w-4" />
                Properties
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2" data-testid="email-tab">
                <Mail className="h-4 w-4" />
                Email Setup
              </TabsTrigger>
            </TabsList>
            
            {/* Search Tab */}
            <TabsContent value="search" className="space-y-6" data-testid="search-content">
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5 text-blue-600" />
                    Search Investment Properties
                  </CardTitle>
                  <CardDescription>
                    Find properties in St. Louis that meet your investment criteria
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Cities Selection */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Select Cities</Label>
                    <div className="flex flex-wrap gap-2">
                      {cities.map(city => (
                        <Badge
                          key={city}
                          variant={selectedCities.includes(city) ? "default" : "outline"}
                          className="cursor-pointer px-4 py-2 text-sm hover:scale-105 transition-transform"
                          onClick={() => toggleCity(city)}
                          data-testid={`city-${city.toLowerCase().replace(' ', '-')}`}
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {city}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  
                  {/* Price Range */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min-price">Min Price</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          id="min-price"
                          type="number"
                          value={minPrice}
                          onChange={(e) => setMinPrice(Number(e.target.value))}
                          className="pl-10"
                          data-testid="min-price-input"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-price">Max Price</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          id="max-price"
                          type="number"
                          value={maxPrice}
                          onChange={(e) => setMaxPrice(Number(e.target.value))}
                          className="pl-10"
                          data-testid="max-price-input"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Bedrooms */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min-beds">Min Bedrooms</Label>
                      <div className="relative">
                        <Bed className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          id="min-beds"
                          type="number"
                          value={minBedrooms}
                          onChange={(e) => setMinBedrooms(Number(e.target.value))}
                          className="pl-10"
                          data-testid="min-bedrooms-input"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-beds">Max Bedrooms</Label>
                      <div className="relative">
                        <Bed className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                          id="max-beds"
                          type="number"
                          value={maxBedrooms}
                          onChange={(e) => setMaxBedrooms(Number(e.target.value))}
                          className="pl-10"
                          data-testid="max-bedrooms-input"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Property Type */}
                  <div className="space-y-2">
                    <Label htmlFor="property-type">Property Type</Label>
                    <Select value={propertyType} onValueChange={setPropertyType}>
                      <SelectTrigger id="property-type" data-testid="property-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single_family">Single Family</SelectItem>
                        <SelectItem value="multi_family">Multi Family</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Home Style Selection */}
                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Home Styles (Optional)</Label>
                    <div className="flex flex-wrap gap-2">
                      {homeStyles.map(style => (
                        <Badge
                          key={style.value}
                          variant={selectedHomeStyles.includes(style.value) ? "default" : "outline"}
                          className="cursor-pointer px-3 py-1.5 text-sm hover:scale-105 transition-transform"
                          onClick={() => setSelectedHomeStyles(prev =>
                            prev.includes(style.value)
                              ? prev.filter(s => s !== style.value)
                              : [...prev, style.value]
                          )}
                          data-testid={`home-style-${style.value}`}
                        >
                          {style.label}
                        </Badge>
                      ))}
                    </div>
                    {selectedHomeStyles.length > 0 && (
                      <p className="text-xs text-slate-600">
                        Selected: {selectedHomeStyles.length} style{selectedHomeStyles.length > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  
                  {/* Min Cap Rate */}
                  <div className="space-y-2">
                    <Label htmlFor="cap-rate">Minimum Cap Rate (%)</Label>
                    <Input
                      id="cap-rate"
                      type="number"
                      step="0.5"
                      value={minCapRate}
                      onChange={(e) => setMinCapRate(Number(e.target.value))}
                      data-testid="min-cap-rate-input"
                    />
                  </div>
                  
                  {/* Property Requirements */}
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <Label className="text-base font-semibold">Property Requirements</Label>
                    
                    <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg hover:bg-blue-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded">
                          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">Must Have Garage</p>
                          <p className="text-sm text-slate-600">Property must include a garage</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requiresGarage}
                          onChange={(e) => setRequiresGarage(e.target.checked)}
                          className="sr-only peer"
                          data-testid="requires-garage-toggle"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between bg-amber-50 p-4 rounded-lg hover:bg-amber-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="bg-amber-600 p-2 rounded">
                          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">No Damaged Nearby Properties</p>
                          <p className="text-sm text-slate-600">Exclude properties with damaged neighbors</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={excludeDamagedNearby}
                          onChange={(e) => setExcludeDamagedNearby(e.target.checked)}
                          className="sr-only peer"
                          data-testid="exclude-damaged-toggle"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between bg-red-50 p-4 rounded-lg hover:bg-red-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="bg-red-600 p-2 rounded">
                          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">No Nearby Vacant Properties</p>
                          <p className="text-sm text-slate-600">Exclude homes near vacant properties (>100 days)</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={excludeVacantNearby}
                          onChange={(e) => setExcludeVacantNearby(e.target.checked)}
                          className="sr-only peer"
                          data-testid="exclude-vacant-toggle"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
                      </label>
                    </div>
                    
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-800">
                        <strong>✓ Active Filters:</strong> {[requiresGarage && "Garage Required", excludeDamagedNearby && "No Damaged Nearby", excludeVacantNearby && "No Vacant Nearby"].filter(Boolean).join(", ") || "No filters active"}
                      </p>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={searchProperties} 
                    disabled={loading} 
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-6 text-lg"
                    data-testid="search-button"
                  >
                    {loading ? "Searching..." : "Search Properties"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            
            {/* Properties Tab */}
            <TabsContent value="properties" className="space-y-4" data-testid="properties-content">
              {properties.length === 0 ? (
                <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                  <CardContent className="py-12 text-center">
                    <Home className="h-16 w-16 mx-auto text-slate-300 mb-4" />
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No Properties Found</h3>
                    <p className="text-slate-600 mb-4">Start searching to find investment opportunities</p>
                    <Button onClick={() => setActiveTab("search")} data-testid="start-searching-button">
                      Start Searching
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {properties.map((property, index) => (
                    <Card key={property.zpid} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/80 backdrop-blur-sm overflow-hidden group" data-testid={`property-card-${index}`}>
                      <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 pb-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-xl" style={{fontFamily: 'Space Grotesk, sans-serif'}}>
                                {property.address}
                              </CardTitle>
                              {property.url && (
                                <a 
                                  href={property.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 transition-colors"
                                  data-testid={`zillow-link-${index}`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                            <CardDescription className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {property.city}, {property.state} {property.zip_code}
                            </CardDescription>
                          </div>
                          <Badge className="bg-green-100 text-green-800 border-green-200" data-testid={`cap-rate-${index}`}>
                            {property.cap_rate?.toFixed(1)}% Cap
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        {/* Price and Details */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                          <div className="flex-1">
                            <div 
                              className="cursor-pointer hover:bg-slate-50 rounded p-2 -m-2 transition-colors"
                              onClick={() => {setEditingProperty(property.zpid); setEditingField('price');}}
                            >
                              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                                Purchase Price
                                <span className="opacity-50 hover:opacity-100 transition-opacity">✏️</span>
                              </p>
                              {editingProperty === property.zpid && editingField === 'price' ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-2xl font-bold text-slate-900">$</span>
                                  <Input
                                    type="number"
                                    defaultValue={property.price}
                                    onBlur={(e) => updatePropertyField(property.zpid, 'price', e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && updatePropertyField(property.zpid, 'price', e.target.value)}
                                    className="h-10 text-2xl font-bold px-2"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    data-testid={`price-input-${index}`}
                                  />
                                </div>
                              ) : (
                                <p className="text-3xl font-bold text-slate-900 hover:text-blue-600 transition-colors" style={{fontFamily: 'Space Grotesk, sans-serif'}}>
                                  ${property.price?.toLocaleString()}
                                </p>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 mt-1">
                              {property.bedrooms || 'N/A'} bed • {property.bathrooms || 'N/A'} bath • {property.sqft?.toLocaleString() || 'N/A'} sqft
                            </p>
                          </div>
                        </div>
                        
                        {/* Investment Metrics */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="text-xs text-slate-600 mb-1">Cap Rate</p>
                            <p className="text-lg font-bold text-blue-700">{property.cap_rate?.toFixed(2)}%</p>
                          </div>
                          <div className="bg-emerald-50 rounded-lg p-3">
                            <p className="text-xs text-slate-600 mb-1">ROI</p>
                            <p className="text-lg font-bold text-emerald-700">{property.roi?.toFixed(2)}%</p>
                          </div>
                          <div className="bg-indigo-50 rounded-lg p-3">
                            <p className="text-xs text-slate-600 mb-1">IRR</p>
                            <p className="text-lg font-bold text-indigo-700">{property.irr?.toFixed(2)}%</p>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-3">
                            <p className="text-xs text-slate-600 mb-1">Cash Flow</p>
                            <p className="text-sm font-bold text-purple-700">${property.annual_cash_flow?.toLocaleString()}/yr</p>
                          </div>
                          <div className="bg-amber-50 rounded-lg p-3 relative group cursor-pointer col-span-2" onClick={() => {setEditingProperty(property.zpid); setEditingField('monthly_rent');}}>
                            <p className="text-xs text-slate-600 mb-1 flex items-center justify-between">
                              Est. Rent
                              <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">✏️ Edit</span>
                            </p>
                            {editingProperty === property.zpid && editingField === 'monthly_rent' ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-amber-700">$</span>
                                <Input
                                  type="number"
                                  defaultValue={property.monthly_rent}
                                  onBlur={(e) => updatePropertyRent(property.zpid, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      updatePropertyRent(property.zpid, e.target.value);
                                    }
                                  }}
                                  className="h-7 text-sm font-bold text-amber-700 px-1 py-0"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                  data-testid={`rent-input-${index}`}
                                />
                                <span className="text-xs font-bold text-amber-700">/mo</span>
                              </div>
                            ) : (
                              <p className="text-sm font-bold text-amber-700 hover:underline">${property.monthly_rent?.toLocaleString()}/mo</p>
                            )}
                          </div>
                        </div>
                        
                        {/* Property Features */}
                        <div className="flex gap-2 flex-wrap pt-2">
                          {property.has_garage && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
                              🚗 {property.garage_spaces || 1} Car Garage
                            </Badge>
                          )}
                          {property.neighborhood_quality && (
                            <Badge variant="secondary" className={
                              property.neighborhood_quality === 'excellent' ? 'bg-green-100 text-green-800 border-green-200' :
                              property.neighborhood_quality === 'good' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              'bg-slate-100 text-slate-800 border-slate-200'
                            }>
                              {property.neighborhood_quality === 'excellent' ? '⭐ Excellent' :
                               property.neighborhood_quality === 'good' ? '✓ Good' : property.neighborhood_quality} Area
                            </Badge>
                          )}
                          {property.nearby_vacant_properties === 0 && property.nearby_damaged_properties === 0 && (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                              ✓ Clean Neighborhood
                            </Badge>
                          )}
                        </div>
                        
                        {/* Editable Financial Parameters */}
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                          {/* Insurance */}
                          <div className="bg-slate-50 rounded p-2 cursor-pointer hover:bg-slate-100" onClick={() => {setEditingProperty(property.zpid); setEditingField('insurance');}}>
                            <p className="text-xs text-slate-600">Insurance/yr ✏️</p>
                            {editingProperty === property.zpid && editingField === 'insurance' ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs">$</span>
                                <Input
                                  type="number"
                                  defaultValue={property.insurance}
                                  onBlur={(e) => updatePropertyField(property.zpid, 'insurance', e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && updatePropertyField(property.zpid, 'insurance', e.target.value)}
                                  className="h-6 text-xs px-1"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ) : (
                              <p className="text-sm font-semibold">${property.insurance?.toLocaleString()}</p>
                            )}
                          </div>
                          
                          {/* Interest Rate */}
                          <div className="bg-slate-50 rounded p-2 cursor-pointer hover:bg-slate-100" onClick={() => {setEditingProperty(property.zpid); setEditingField('interest_rate');}}>
                            <p className="text-xs text-slate-600">Interest Rate ✏️</p>
                            {editingProperty === property.zpid && editingField === 'interest_rate' ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  step="0.1"
                                  defaultValue={(property.interest_rate * 100).toFixed(1)}
                                  onBlur={(e) => updatePropertyField(property.zpid, 'interest_rate', parseFloat(e.target.value) / 100)}
                                  onKeyDown={(e) => e.key === 'Enter' && updatePropertyField(property.zpid, 'interest_rate', parseFloat(e.target.value) / 100)}
                                  className="h-6 text-xs px-1"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-xs">%</span>
                              </div>
                            ) : (
                              <p className="text-sm font-semibold">{((property.interest_rate || 0.07) * 100).toFixed(1)}%</p>
                            )}
                          </div>
                          
                          {/* Down Payment */}
                          <div className="bg-slate-50 rounded p-2 cursor-pointer hover:bg-slate-100" onClick={() => {setEditingProperty(property.zpid); setEditingField('down_payment_pct');}}>
                            <p className="text-xs text-slate-600">Down Payment ✏️</p>
                            {editingProperty === property.zpid && editingField === 'down_payment_pct' ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  step="1"
                                  defaultValue={(property.down_payment_pct * 100).toFixed(0)}
                                  onBlur={(e) => updatePropertyField(property.zpid, 'down_payment_pct', parseFloat(e.target.value) / 100)}
                                  onKeyDown={(e) => e.key === 'Enter' && updatePropertyField(property.zpid, 'down_payment_pct', parseFloat(e.target.value) / 100)}
                                  className="h-6 text-xs px-1"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-xs">%</span>
                              </div>
                            ) : (
                              <p className="text-sm font-semibold">{((property.down_payment_pct || 0.20) * 100).toFixed(0)}%</p>
                            )}
                          </div>
                          
                          {/* Deferred Maintenance */}
                          <div className="bg-slate-50 rounded p-2 cursor-pointer hover:bg-slate-100" onClick={() => {setEditingProperty(property.zpid); setEditingField('deferred_maintenance');}}>
                            <p className="text-xs text-slate-600">Def. Maint. ✏️</p>
                            {editingProperty === property.zpid && editingField === 'deferred_maintenance' ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs">$</span>
                                <Input
                                  type="number"
                                  defaultValue={property.deferred_maintenance || 0}
                                  onBlur={(e) => updatePropertyField(property.zpid, 'deferred_maintenance', e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && updatePropertyField(property.zpid, 'deferred_maintenance', e.target.value)}
                                  className="h-6 text-xs px-1"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ) : (
                              <p className="text-sm font-semibold">${(property.deferred_maintenance || 0).toLocaleString()}</p>
                            )}
                          </div>
                        </div>
                        
                        {/* Read-only Info */}
                        <div className="text-xs text-slate-600 space-y-1 pt-2">
                          <p>Property Tax: ${property.property_tax?.toLocaleString()}/year</p>
                          <p>NOI: ${property.noi?.toLocaleString()}/year</p>
                        </div>
                      </CardContent>
                      <CardFooter className="bg-slate-50">
                        {property.url && (
                          <Button 
                            variant="outline" 
                            className="w-full group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-colors"
                            onClick={() => window.open(property.url, '_blank')}
                            data-testid={`view-zillow-${index}`}
                          >
                            View on Zillow
                            <ExternalLink className="ml-2 h-4 w-4" />
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            
            {/* Email Setup Tab */}
            <TabsContent value="email" className="space-y-6" data-testid="email-content">
              <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5 text-blue-600" />
                    Weekly Email Notifications
                  </CardTitle>
                  <CardDescription>
                    Get properties matching your criteria delivered to your inbox weekly
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your.email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      data-testid="email-input"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email-cap-rate">Minimum Cap Rate (%)</Label>
                      <Input
                        id="email-cap-rate"
                        type="number"
                        step="0.5"
                        value={emailMinCapRate}
                        onChange={(e) => setEmailMinCapRate(Number(e.target.value))}
                        data-testid="email-cap-rate-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email-roi">Minimum ROI (%)</Label>
                      <Input
                        id="email-roi"
                        type="number"
                        step="0.5"
                        value={emailMinROI}
                        onChange={(e) => setEmailMinROI(Number(e.target.value))}
                        data-testid="email-roi-input"
                      />
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <Button 
                      onClick={saveEmailPreferences} 
                      className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      data-testid="save-preferences-button"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Save Preferences
                    </Button>
                    <Button 
                      onClick={sendTestEmail} 
                      variant="outline"
                      data-testid="send-test-email-button"
                    >
                      Send Test Email
                    </Button>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
                    <h4 className="font-semibold text-blue-900 mb-2">How it works</h4>
                    <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                      <li>Weekly emails sent every Monday at 9 AM</li>
                      <li>Only properties matching your criteria are included</li>
                      <li>Direct links to view properties on Zillow</li>
                      <li>Detailed investment metrics for each property</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}

export default App;

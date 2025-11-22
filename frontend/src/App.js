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
  const [selectedProperties, setSelectedProperties] = useState([]);
  
  const cities = [
    "Affton",
    "Ballwin",
    "Bella Villa",
    "Bellefontaine",
    "Bellerive",
    "Bel-nor",
    "Belridge",
    "Berkeley",
    "Beverly Hills",
    "Black Jack",
    "Breckenridge Hills",
    "Brentwood",
    "Bridgeton",
    "Calverton Park",
    "Castle Point",
    "Champ",
    "Charlack",
    "Chesterfield",
    "Clarkson Valley",
    "Clayton",
    "Concord",
    "Cool Valley",
    "Country Club Hills",
    "Country Life Acres",
    "Crestwood",
    "Creve Ceur",
    "Crystal Lake Park",
    "Dellwood",
    "Des Peres",
    "Edmundson",
    "Ellisville",
    "Eureka",
    "Fenton",
    "Ferguson",
    "Flordell Hills",
    "Florissant",
    "Frontenac",
    "Glasgow Village",
    "Glencoe",
    "Glendale",
    "Glen Echo Park",
    "Grantwood Village",
    "Green Park",
    "Greendale",
    "Grover",
    "Hanley Hills",
    "Hazelwood",
    "Hillsdale",
    "Huntleigh",
    "Jennings",
    "Kinloch",
    "Kirkwood",
    "Ladue",
    "Lakeshire",
    "Lemay",
    "Mackenzie",
    "Manchester",
    "Maplewood",
    "Marlborough",
    "Maryland Heights",
    "Mehlville",
    "Moline Acres",
    "Normandy",
    "Northwoods",
    "Norwood Court",
    "Oakland",
    "Oakville",
    "Olivette",
    "Overland",
    "Pagedale",
    "Pasadena Hills",
    "Pasadena Park",
    "Pine Lawn",
    "Richmond Heights",
    "Riverview",
    "Rock Hill",
    "Sappington",
    "Shrewsbury",
    "Spanish Lake",
    "Southwest Garden",
    "St. Ann",
    "St. John",
    "Sunset Hills",
    "Sycamore Hills",
    "The Hill",
    "Town & Country",
    "Twin Oaks",
    "University City",
    "Uplands Park",
    "Valley Park",
    "Velda City",
    "Velda Village Hills",
    "Vinita Park",
    "Vinita Terrace",
    "Warson Woods",
    "Webster Groves",
    "Wellston",
    "Westwood",
    "Wilbur Park",
    "Wildwood",
    "Winchester",
    "Woodson Terrace",
    "St. Charles"
  ];
  
  // Search filters - Default selected cities (marked as "Yes" in the list)
  const [selectedCities, setSelectedCities] = useState([
    "Affton",
    "Bella Villa",
    "Florissant",
    "Lemay",
    "Mehlville",
    "Shrewsbury",
    "St. Ann",
    "The Hill",
    "University City",
    "Velda City",
    "Webster Groves",
    "St. Charles"
  ]);
  const [minPrice, setMinPrice] = useState(100000);
  const [maxPrice, setMaxPrice] = useState(175000);
  const [minBedrooms, setMinBedrooms] = useState(2);
  const [maxBedrooms, setMaxBedrooms] = useState(3);
  const [propertyType, setPropertyType] = useState("single_family");
  const [minCapRate, setMinCapRate] = useState(7);
  const [requiresGarage, setRequiresGarage] = useState(true);
  const [excludeDamagedNearby, setExcludeDamagedNearby] = useState(true);
  const [excludeVacantNearby, setExcludeVacantNearby] = useState(true);
  const [maxVacantDays, setMaxVacantDays] = useState(100);
  const [minDaysOnMarket, setMinDaysOnMarket] = useState(0);
  const [resultLimit, setResultLimit] = useState(50);
  const [selectedHomeStyles, setSelectedHomeStyles] = useState([]);
  const [excludeMold, setExcludeMold] = useState(true);
  const [excludeFoundationIssues, setExcludeFoundationIssues] = useState(true);
  const [excludeFloodZone, setExcludeFloodZone] = useState(true);
  
  // For inline editing
  const [editingProperty, setEditingProperty] = useState(null);
  const [editingField, setEditingField] = useState(null);
  
  // Email preferences
  const [email, setEmail] = useState("");
  const [emailMinCapRate, setEmailMinCapRate] = useState(7);
  const [emailMinROI, setEmailMinROI] = useState(8);
  const [emailMinIRR, setEmailMinIRR] = useState(10);
  const [emailFrequency, setEmailFrequency] = useState("weekly");
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
        max_nearby_vacant_days: maxVacantDays,
        exclude_damaged_nearby: excludeDamagedNearby,
        exclude_mold: excludeMold,
        exclude_foundation_issues: excludeFoundationIssues,
        exclude_flood_zone: excludeFloodZone,
        min_days_on_market: minDaysOnMarket,
        limit: resultLimit
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
        min_irr: emailMinIRR / 100,
        frequency: emailFrequency,
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
  
  const handlePropertyTypeChange = (type) => {
    setPropertyType(type);
    
    // Auto-adjust price ranges based on property type
    if (type === "single_family") {
      setMinPrice(100000);
      setMaxPrice(175000);
    } else if (type === "multi_family") {
      setMinPrice(150000);
      setMaxPrice(300000);
    } else if (type === "both") {
      setMinPrice(100000);
      setMaxPrice(300000);
    }
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
  
  const togglePropertySelection = (zpid) => {
    setSelectedProperties(prev => 
      prev.includes(zpid) ? prev.filter(id => id !== zpid) : [...prev, zpid]
    );
  };
  
  const selectAllProperties = () => {
    if (selectedProperties.length === properties.length) {
      setSelectedProperties([]);
    } else {
      setSelectedProperties(properties.map(p => p.zpid));
    }
  };
  
  const exportToSheets = async () => {
    if (selectedProperties.length === 0) {
      toast.error("Please select at least one property");
      return;
    }
    
    try {
      const selectedProps = properties.filter(p => selectedProperties.includes(p.zpid));
      const response = await axios.post(`${API}/export-to-sheets`, { properties: selectedProps });
      toast.success(`${selectedProperties.length} properties exported to Google Sheets!`);
    } catch (error) {
      console.error("Error exporting to sheets:", error);
      toast.error("Failed to export to Google Sheets");
    }
  };
  
  const emailSelectedProperties = async () => {
    if (selectedProperties.length === 0) {
      toast.error("Please select at least one property");
      return;
    }
    
    if (!email) {
      toast.error("Please enter your email address in Email Setup tab");
      return;
    }
    
    try {
      const selectedProps = properties.filter(p => selectedProperties.includes(p.zpid));
      const response = await axios.post(`${API}/email-selected-properties`, { 
        properties: selectedProps,
        email: email 
      });
      toast.success(`${selectedProperties.length} properties emailed to ${email}!`);
    } catch (error) {
      console.error("Error emailing properties:", error);
      toast.error("Failed to email properties");
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
                  <p className="text-xs text-slate-500 italic mt-0.5">by Gokhan Egilmez</p>
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
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Select Cities ({selectedCities.length} selected)</Label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSelectedCities(cities)}
                          className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedCities([])}
                          className="text-xs px-3 py-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400 transition-colors"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
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
                    <Select value={propertyType} onValueChange={handlePropertyTypeChange}>
                      <SelectTrigger id="property-type" data-testid="property-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single_family">Single Family</SelectItem>
                        <SelectItem value="multi_family">Multi Family</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-500">
                      Price range auto-adjusts based on property type
                    </p>
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
                  
                  {/* Days on Market Filter */}
                  <div className="space-y-2">
                    <Label htmlFor="days-on-market">Minimum Days on Market</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="days-on-market"
                        type="number"
                        min="0"
                        step="5"
                        value={minDaysOnMarket}
                        onChange={(e) => setMinDaysOnMarket(Number(e.target.value))}
                        className="flex-1"
                        data-testid="min-days-on-market-input"
                      />
                      <span className="text-sm font-medium text-slate-700 whitespace-nowrap">days</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {minDaysOnMarket === 0 
                        ? "Showing all properties regardless of listing duration" 
                        : `Only show properties listed for more than ${minDaysOnMarket} days`}
                    </p>
                  </div>
                  
                  {/* Number of Results */}
                  <div className="space-y-2 pt-4 border-t border-slate-200">
                    <Label htmlFor="result-limit" className="text-base font-semibold">Number of Properties to Display</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="result-limit"
                        type="number"
                        min="1"
                        max="100"
                        step="10"
                        value={resultLimit}
                        onChange={(e) => setResultLimit(Number(e.target.value))}
                        className="flex-1"
                        data-testid="result-limit-input"
                      />
                      <span className="text-sm font-medium text-slate-700 whitespace-nowrap">properties</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Top {resultLimit} properties sorted by highest Cap Rate and ROI (max: 100)
                    </p>
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
                    
                    <div className="bg-red-50 rounded-lg hover:bg-red-100 transition-colors">
                      <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-red-600 p-2 rounded">
                            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-slate-900">No Nearby Vacant Properties</p>
                            <p className="text-sm text-slate-600">Exclude homes near vacant properties</p>
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
                      {excludeVacantNearby && (
                        <div className="px-4 pb-4 pt-0">
                          <Label htmlFor="vacant-days" className="text-xs text-slate-600 mb-2 block">
                            Maximum vacant days threshold
                          </Label>
                          <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-red-200">
                            <Input
                              id="vacant-days"
                              type="number"
                              min="0"
                              step="10"
                              value={maxVacantDays}
                              onChange={(e) => setMaxVacantDays(Number(e.target.value))}
                              className="h-8 w-24 text-sm"
                              data-testid="max-vacant-days-input"
                            />
                            <span className="text-sm font-medium text-slate-700">days</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            Properties with nearby homes vacant longer than {maxVacantDays} days will be excluded
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between bg-purple-50 p-4 rounded-lg hover:bg-purple-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-600 p-2 rounded">
                          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">No Mold Issues</p>
                          <p className="text-sm text-slate-600">Exclude properties with mold problems</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={excludeMold}
                          onChange={(e) => setExcludeMold(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between bg-orange-50 p-4 rounded-lg hover:bg-orange-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="bg-orange-600 p-2 rounded">
                          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">No Foundation Issues</p>
                          <p className="text-sm text-slate-600">Exclude properties with foundation problems</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={excludeFoundationIssues}
                          onChange={(e) => setExcludeFoundationIssues(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                      </label>
                    </div>
                    
                    <div className="flex items-center justify-between bg-cyan-50 p-4 rounded-lg hover:bg-cyan-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="bg-cyan-600 p-2 rounded">
                          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">No Flood Zone</p>
                          <p className="text-sm text-slate-600">Exclude properties in flood zones</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={excludeFloodZone}
                          onChange={(e) => setExcludeFloodZone(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-cyan-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
                      </label>
                    </div>
                    
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-800">
                        <strong>✓ Active Filters:</strong> {[requiresGarage && "Garage Required", excludeDamagedNearby && "No Damaged Nearby", excludeVacantNearby && "No Vacant Nearby", excludeMold && "No Mold", excludeFoundationIssues && "No Foundation Issues", excludeFloodZone && "No Flood Zone"].filter(Boolean).join(", ") || "No filters active"}
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
              {properties.length > 0 && (
                <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-slate-200">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={selectAllProperties}
                      data-testid="select-all-button"
                    >
                      {selectedProperties.length === properties.length ? "Deselect All" : "Select All"}
                    </Button>
                    <span className="text-sm text-slate-600">
                      {selectedProperties.length} of {properties.length} selected
                    </span>
                  </div>
                  {selectedProperties.length > 0 && (
                    <div className="flex gap-3">
                      <Button
                        onClick={exportToSheets}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        data-testid="export-sheets-button"
                      >
                        <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
                        </svg>
                        Export to Sheets
                      </Button>
                      <Button
                        onClick={emailSelectedProperties}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                        data-testid="email-selected-button"
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Email Selected
                      </Button>
                    </div>
                  )}
                </div>
              )}
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
                        <div className="flex justify-between items-start gap-3">
                          <div className="flex items-start gap-3 flex-1">
                            <input
                              type="checkbox"
                              checked={selectedProperties.includes(property.zpid)}
                              onChange={() => togglePropertySelection(property.zpid)}
                              className="mt-1.5 w-5 h-5 text-blue-600 rounded cursor-pointer"
                              data-testid={`select-property-${index}`}
                            />
                            <div className="flex-1">
                              <CardTitle className="text-xl mb-1" style={{fontFamily: 'Space Grotesk, sans-serif'}}>
                                {property.address}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {property.city}, {property.state} {property.zip_code}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 items-end">
                            <Badge className="bg-green-100 text-green-800 border-green-200" data-testid={`cap-rate-${index}`}>
                              {property.cap_rate?.toFixed(1)}% Cap
                            </Badge>
                            <a 
                              href={property.url || `https://www.zillow.com/homes/${property.address}-${property.city}-${property.state}-${property.zip_code}_rb/`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm font-semibold shadow-sm"
                              data-testid={`zillow-header-btn-${index}`}
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2L2 12h3v8h6v-6h2v6h6v-8h3L12 2z"/>
                              </svg>
                              View on Zillow
                            </a>
                          </div>
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
                        
                        {/* RECA Contamination Warning */}
                        {property.in_reca_zone && (
                          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                              </svg>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-red-900">⚠️ RECA Contamination Zone</p>
                                <p className="text-xs text-red-800 mt-1">{property.contamination_notes || "Property located in RECA impacted area"}</p>
                                <p className="text-xs text-red-700 mt-1 font-medium">ZIP Code: {property.zip_code}</p>
                                
                                <div className="mt-2 space-y-1">
                                  <p className="text-xs font-semibold text-red-900">Proximity to Contamination Sites:</p>
                                  {property.proximity_to_coldwater_creek && (
                                    <div className="flex items-center gap-1 text-xs">
                                      <span className={`px-2 py-0.5 rounded font-medium ${
                                        property.proximity_to_coldwater_creek === "immediate" ? "bg-red-600 text-white" : 
                                        property.proximity_to_coldwater_creek === "near" ? "bg-orange-500 text-white" :
                                        property.proximity_to_coldwater_creek === "moderate" ? "bg-yellow-400 text-slate-900" :
                                        "bg-green-200 text-green-900"
                                      }`}>
                                        Coldwater Creek: {property.proximity_to_coldwater_creek.toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                  {property.proximity_to_westlake_landfill && (
                                    <div className="flex items-center gap-1 text-xs">
                                      <span className={`px-2 py-0.5 rounded font-medium ${
                                        property.proximity_to_westlake_landfill === "immediate" ? "bg-red-600 text-white" : 
                                        property.proximity_to_westlake_landfill === "near" ? "bg-orange-500 text-white" :
                                        property.proximity_to_westlake_landfill === "moderate" ? "bg-yellow-400 text-slate-900" :
                                        "bg-green-200 text-green-900"
                                      }`}>
                                        West Lake Landfill: {property.proximity_to_westlake_landfill.toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                
                                <a 
                                  href="https://reca-missouri-resources.org/impacted-areas/st-louis-county/" 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-red-700 underline mt-2 inline-block hover:text-red-900 font-medium"
                                >
                                  📋 Learn more about RECA zones & eligibility →
                                </a>
                              </div>
                            </div>
                          </div>
                        )}
                        
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
                          
                          {/* Property Tax - EDITABLE */}
                          <div className="bg-slate-50 rounded p-2 cursor-pointer hover:bg-slate-100" onClick={() => {setEditingProperty(property.zpid); setEditingField('property_tax');}}>
                            <p className="text-xs text-slate-600">Property Tax ✏️</p>
                            {editingProperty === property.zpid && editingField === 'property_tax' ? (
                              <div className="flex items-center gap-1">
                                <span className="text-xs">$</span>
                                <Input
                                  type="number"
                                  defaultValue={property.property_tax || (property.price * 0.018)}
                                  onBlur={(e) => updatePropertyField(property.zpid, 'property_tax', e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && updatePropertyField(property.zpid, 'property_tax', e.target.value)}
                                  className="h-6 text-xs px-1"
                                  autoFocus
                                  onClick={(e) => e.stopPropagation()}
                                />
                                <span className="text-xs">/year</span>
                              </div>
                            ) : (
                              <p className="text-sm font-semibold">${(property.property_tax || property.price * 0.018)?.toLocaleString()}/year</p>
                            )}
                          </div>
                        </div>
                        
                        {/* Read-only Info */}
                        <div className="text-xs text-slate-600 space-y-1 pt-2">
                          <p>NOI: ${property.noi?.toLocaleString()}/year</p>
                        </div>
                      </CardContent>
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <div className="space-y-2">
                      <Label htmlFor="email-irr">Minimum IRR (%)</Label>
                      <Input
                        id="email-irr"
                        type="number"
                        step="0.5"
                        value={emailMinIRR}
                        onChange={(e) => setEmailMinIRR(Number(e.target.value))}
                        data-testid="email-irr-input"
                      />
                    </div>
                  </div>
                  
                  {/* Email Frequency */}
                  <div className="space-y-2">
                    <Label htmlFor="email-frequency">Email Alert Frequency</Label>
                    <Select value={emailFrequency} onValueChange={setEmailFrequency}>
                      <SelectTrigger id="email-frequency" data-testid="email-frequency-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly (Monday)</SelectItem>
                        <SelectItem value="biweekly">Bi-Weekly (Every 2 weeks)</SelectItem>
                        <SelectItem value="monthly">Monthly (1st of month)</SelectItem>
                      </SelectContent>
                    </Select>
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
                      <li>Emails sent based on your selected frequency</li>
                      <li>Only properties matching your Cap Rate, ROI, and IRR criteria</li>
                      <li>Direct links to view properties on Zillow</li>
                      <li>Detailed investment metrics (Cap Rate, ROI, IRR, Cash Flow)</li>
                      <li>Weekly = Monday 9 AM, Daily = 9 AM, Bi-Weekly = Every other Monday, Monthly = 1st of month</li>
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

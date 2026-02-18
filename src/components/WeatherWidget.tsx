import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud, CloudLightning, CloudRain, Moon, Snowflake, Loader2, Sparkles, Umbrella, Thermometer, RefreshCw, Droplets } from "lucide-react";
import { format, addDays, subDays, getHours } from "date-fns";
import { Button } from "@/components/ui/button";

export const WeatherWidget = () => {
  const [data, setData] = useState<{
    start: WeatherPoint | null;
    peak: WeatherPoint | null;
    close: WeatherPoint | null;
  }>({ start: null, peak: null, close: null });
  const [displayDate, setDisplayDate] = useState<Date | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  interface WeatherPoint {
    temp: number;
    rain: number;
    code: number;
    time: string;
  }

  const fetchWeather = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        "https://api.open-meteo.com/v1/forecast?latitude=51.5074&longitude=-0.1278&hourly=temperature_2m,precipitation_probability,weather_code&timezone=Europe%2FLondon"
      );
      
      if (!response.ok) throw new Error("Weather fetch failed");

      const json = await response.json();
      
      // Determine the "Party Night" reference date
      const now = new Date();
      const currentHour = getHours(now);
      
      // If it's early morning (00:00 - 03:59), we consider the "Party Night" to have started yesterday
      const referenceDate = currentHour < 4 ? subDays(now, 1) : now;
      setDisplayDate(referenceDate);
      const nextDay = addDays(referenceDate, 1);

      // Construct ISO strings to match API (yyyy-MM-ddTHH:00)
      // Note: API returns local time strings because of &timezone=Europe%2FLondon
      const startStr = `${format(referenceDate, "yyyy-MM-dd")}T19:00`;
      const peakStr = `${format(referenceDate, "yyyy-MM-dd")}T23:00`;
      const closeStr = `${format(nextDay, "yyyy-MM-dd")}T03:00`;

      const times = json.hourly.time as string[];
      
      const getIndex = (iso: string) => times.findIndex((t) => t === iso);
      const startIndex = getIndex(startStr);
      const peakIndex = getIndex(peakStr);
      const closeIndex = getIndex(closeStr);

      const getPoint = (idx: number): WeatherPoint | null => {
        if (idx === -1) return null;
        return {
          temp: json.hourly.temperature_2m[idx],
          rain: json.hourly.precipitation_probability[idx],
          code: json.hourly.weather_code[idx],
          time: json.hourly.time[idx],
        };
      };

      setData({
        start: getPoint(startIndex),
        peak: getPoint(peakIndex),
        close: getPoint(closeIndex),
      });
      setLastUpdated(new Date());
      setError(false);
    } catch (err) {
      console.error("Failed to load weather", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  const getWeatherIcon = (code: number, className = "h-6 w-6") => {
    if (code === 0) return <Moon className={`${className} text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]`} />;
    if (code >= 1 && code <= 3) return <Cloud className={`${className} text-slate-300`} />;
    if (code >= 45 && code <= 48) return <Cloud className={`${className} text-slate-400`} />;
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain className={`${className} text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]`} />;
    if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return <Snowflake className={`${className} text-blue-200`} />;
    if (code >= 95) return <CloudLightning className={`${className} text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]`} />;
    return <Moon className={`${className} text-slate-400`} />;
  };

  const getDancerAdvice = () => {
    if (!data.peak) return null;
    
    // Calculate max rain probability across the night to give a safe summary
    const maxRain = Math.max(
      data.start?.rain || 0,
      data.peak?.rain || 0,
      data.close?.rain || 0
    );

    if (maxRain > 30) return { text: `${maxRain}% chance of rain - Bring an umbrella!`, icon: <Umbrella className="h-4 w-4" />, variant: "warning" };
    if (maxRain > 0) return { text: `Some rain expected (${maxRain}%)`, icon: <CloudRain className="h-4 w-4" />, variant: "info" };
    if (data.peak.temp < 5) return { text: "Chilly night - bring layers", icon: <Thermometer className="h-4 w-4" />, variant: "cold" };
    if (data.peak.temp > 22) return { text: "Warm night ahead", icon: <Sparkles className="h-4 w-4" />, variant: "warm" };
    return { text: "No rain expected tonight", icon: <Moon className="h-4 w-4" />, variant: "neutral" };
  };

  const advice = getDancerAdvice();

  if (error) return (
    <Card className="w-full bg-slate-900 border-red-900/50">
      <CardContent className="flex items-center justify-center p-6 text-red-400 gap-2">
        <CloudLightning className="h-5 w-5" />
        <span>Weather unavailable</span>
        <Button variant="ghost" size="sm" onClick={fetchWeather}>Retry</Button>
      </CardContent>
    </Card>
  );

  return (
    <Card className="w-full relative overflow-hidden bg-gradient-to-br from-[#1A1F2C] via-[#221F26] to-[#1A1F2C] border-purple-500/20 shadow-xl shadow-purple-900/10">
      {/* Background ambient glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/10 blur-3xl rounded-full" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-600/10 blur-2xl rounded-full" />

      <CardHeader className="pb-3 pt-4 border-b border-white/5 bg-black/20 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base font-semibold text-white flex items-center gap-2 tracking-wide">
              <Moon className="h-4 w-4 text-purple-400" />
              London
            </CardTitle>
            {displayDate && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-slate-200 border border-white/5">
                {format(displayDate, "EEE d MMM")}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-[10px] text-slate-500">
                {format(lastUpdated, "HH:mm")}
              </span>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-slate-400 hover:text-white" 
              onClick={fetchWeather}
              disabled={loading}
              title={lastUpdated ? `Updated at ${format(lastUpdated, "HH:mm")}` : "Refresh weather"}
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
              <span className="sr-only">Refresh weather</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-4 pb-4">
        {loading && !data.peak ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
          </div>
        ) : (
          <div className="space-y-4">
             {/* Main Metrics */}
            <div className="grid grid-cols-3 gap-2 divide-x divide-white/5">
              {/* Start Column */}
              <div className="flex flex-col items-center gap-2 group">
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">7 PM</div>
                {data.start && (
                  <>
                    <div className="transform transition-transform group-hover:scale-110 duration-300">
                      {getWeatherIcon(data.start.code, "h-7 w-7")}
                    </div>
                    <div className="flex flex-col items-center -space-y-0.5">
                      <span className="text-lg font-bold text-slate-100">{Math.round(data.start.temp)}°</span>
                      <div className={`flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full ${data.start.rain > 0 ? 'bg-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]' : 'opacity-40'}`}>
                        <Droplets className={`h-3 w-3 ${data.start.rain > 0 ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span className={`text-xs font-bold ${data.start.rain > 0 ? 'text-blue-200' : 'text-slate-500'}`}>{data.start.rain}%</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Peak Column */}
              <div className="flex flex-col items-center gap-2 group relative">
                {/* Highlight for peak time */}
                <div className="absolute inset-x-0 -top-4 -bottom-4 bg-purple-500/5 rounded-sm -z-10" />
                <div className="text-[10px] font-bold tracking-wider text-purple-300 uppercase">11 PM</div>
                {data.peak && (
                  <>
                     <div className="transform transition-transform group-hover:scale-110 duration-300">
                      {getWeatherIcon(data.peak.code, "h-8 w-8")}
                    </div>
                    <div className="flex flex-col items-center -space-y-0.5">
                      <span className="text-xl font-bold text-white">{Math.round(data.peak.temp)}°</span>
                       <div className={`flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full ${data.peak.rain > 0 ? 'bg-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]' : 'opacity-40'}`}>
                        <Droplets className={`h-3 w-3 ${data.peak.rain > 0 ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span className={`text-xs font-bold ${data.peak.rain > 0 ? 'text-blue-200' : 'text-slate-500'}`}>{data.peak.rain}%</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Close Column */}
              <div className="flex flex-col items-center gap-2 group">
                <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">3 AM</div>
                {data.close && (
                  <>
                    <div className="transform transition-transform group-hover:scale-110 duration-300">
                      {getWeatherIcon(data.close.code, "h-7 w-7")}
                    </div>
                    <div className="flex flex-col items-center -space-y-0.5">
                      <span className="text-lg font-bold text-slate-100">{Math.round(data.close.temp)}°</span>
                       <div className={`flex items-center gap-1.5 mt-2 px-2 py-0.5 rounded-full ${data.close.rain > 0 ? 'bg-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]' : 'opacity-40'}`}>
                        <Droplets className={`h-3 w-3 ${data.close.rain > 0 ? 'text-blue-400' : 'text-slate-500'}`} />
                        <span className={`text-xs font-bold ${data.close.rain > 0 ? 'text-blue-200' : 'text-slate-500'}`}>{data.close.rain}%</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Dancer Advice Footer */}
            {advice && (
              <div className={`flex items-center justify-center gap-2 pt-3 pb-1 border-t border-white/5 mt-2 transition-colors duration-300 ${
                advice.variant === 'warning' ? 'text-blue-200' : 'text-slate-300'
              }`}>
                <div className={`p-1.5 rounded-full shrink-0 ${
                  advice.variant === 'warning' ? 'bg-blue-500/30 text-blue-200 ring-1 ring-blue-400/50 shadow-[0_0_10px_rgba(59,130,246,0.2)]' : 
                  advice.variant === 'info' ? 'bg-blue-500/20 text-blue-300' :
                  advice.variant === 'cold' ? 'bg-cyan-500/20 text-cyan-300' :
                  advice.variant === 'warm' ? 'bg-orange-500/20 text-orange-300' :
                  'bg-white/5 text-slate-400'
                }`}>
                  {advice.icon}
                </div>
                <span className={`text-sm font-medium ${
                  advice.variant === 'warning' ? 'font-semibold' : ''
                }`}>
                  {advice.text}
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

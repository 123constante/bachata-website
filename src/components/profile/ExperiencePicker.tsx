import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock } from 'lucide-react';

interface ExperiencePickerProps {
    value?: string | null;
    onChange: (date: string) => void;
    showLabel?: boolean;
}

export const getExperienceLevel = (years: number) => {
    if (years < 1) return { title: 'Newcomer', icon: '🌱', color: 'text-cyan-300' };
    if (years < 2) return { title: 'Rising Star', icon: '🚀', color: 'text-cyan-300' };
    if (years < 5) return { title: 'Experienced', icon: '✨', color: 'text-cyan-300' };
    if (years < 10) return { title: 'Pro Moves', icon: '🌟', color: 'text-cyan-300' };
    return { title: 'Legend', icon: '👑', color: 'text-cyan-300' };
};

export const calculateDuration = (startDateStr: string | null | undefined) => {
    if (!startDateStr) return null;
    const start = new Date(startDateStr);
    if (Number.isNaN(start.getTime())) return null;
    const now = new Date();
    
    // Validate date is not in future
    if (start > now) return { years: 0, months: 0 };

    let years = now.getFullYear() - start.getFullYear();
    let months = now.getMonth() - start.getMonth();

    if (months < 0) {
        years--;
        months += 12;
    }
    return { years, months };
};

export const ExperiencePicker: React.FC<ExperiencePickerProps> = ({ value, onChange, showLabel = false }) => {
    const parsedDate = value ? new Date(value) : undefined;
    const date = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined;
    const selectedMonth = date ? date.getMonth().toString() : undefined;
    const selectedYear = date ? date.getFullYear().toString() : undefined;
    
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 50 }, (_, i) => (currentYear - i).toString());
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const handleDateChange = (type: 'month' | 'year', val: string) => {
        const now = new Date();
        const currentYearVal = selectedYear ? parseInt(selectedYear) : now.getFullYear();
        const currentMonthVal = selectedMonth ? parseInt(selectedMonth) : now.getMonth();

        const parsedVal = parseInt(val);
        if (Number.isNaN(parsedVal)) {
            return;
        }

        let newDate = new Date(currentYearVal, currentMonthVal, 1);
        
        if (type === 'year') {
            newDate.setFullYear(parsedVal);
        } else {
            newDate.setMonth(parsedVal);
        }

        if (Number.isNaN(newDate.getTime())) {
            return;
        }
        
        // Prevent future dates
        if (newDate > now) {
            newDate = now;
        }

        const formatted = newDate.toISOString().split('T')[0];
        onChange(formatted);
    };

    const experience = calculateDuration(value);
    const level = experience ? getExperienceLevel(experience.years) : null;

    return (
        <div className="space-y-4">
            {showLabel && (
                <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 bg-festival-teal/12 rounded-lg">
                        <Clock className="w-5 h-5 text-cyan-300" />
                    </div>
                    <span className='text-xl font-bold'>How long have you been dancing?</span>
                </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-start">
                <div className="flex gap-2 min-w-[200px]">
                    <Select value={selectedMonth} onValueChange={(v) => handleDateChange('month', v)}>
                        <SelectTrigger 
                            className={`
                                flex-1 h-14 text-lg font-medium transition-all duration-200
                                ${selectedMonth ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'bg-background border-input'}
                            `}
                        >
                            <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map((m, i) => (
                                <SelectItem key={i} value={i.toString()} className="text-lg py-2">{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    
                    <Select value={selectedYear} onValueChange={(v) => handleDateChange('year', v)}>
                        <SelectTrigger 
                            className={`
                                w-[100px] h-14 text-lg font-medium transition-all duration-200
                                ${selectedYear ? 'border-primary ring-1 ring-primary/20 bg-primary/5' : 'bg-background border-input'}
                            `}
                        >
                            <SelectValue placeholder="Year" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map((y) => (
                                <SelectItem key={y} value={y} className="text-lg py-2">{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                
                <AnimatePresence mode="wait">
                    {experience && level && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex-1 bg-slate-900 border border-slate-800 shadow-xl rounded-xl p-4 flex items-center gap-4 relative overflow-hidden group min-h-[88px]"
                        >
                                {/* Decorative accent */}
                                <div className="absolute left-0 top-3 bottom-3 w-1.5 bg-festival-teal rounded-r-full" />
                                
                                {/* Icon Container */}
                                <div className="relative w-12 h-12 shrink-0 ml-2">
                                    <div className="absolute inset-0 bg-white/10 rounded-full blur-xl transform group-hover:scale-125 transition-transform duration-500" />
                                    <div className="relative w-full h-full rounded-full bg-gradient-to-br from-white to-slate-200 flex items-center justify-center text-2xl shadow-lg border-2 border-white/20">
                                        {level.icon}
                                    </div>
                                </div>
                                
                                {/* Text Content */}
                                <div>
                                    <div className={`text-[10px] font-bold uppercase tracking-widest mb-0.5 ${level.color}`}>
                                        {level.title}
                                    </div>
                                    <div className="text-xl font-bold text-white tracking-tight leading-none">
                                        {experience.years > 0 && `${experience.years} Year${experience.years !== 1 ? 's' : ''}`}
                                        {experience.years > 0 && experience.months > 0 && <span className="text-slate-500 mx-1.5">&</span>}
                                        {experience.months > 0 && `${experience.months} Month${experience.months !== 1 ? 's' : ''}`}
                                        {experience.years === 0 && experience.months === 0 && 'Just started!'}
                                    </div>
                                </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

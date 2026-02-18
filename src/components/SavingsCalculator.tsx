import { useState } from 'react';
import { motion } from 'framer-motion';
import { Slider } from '@/components/ui/slider';
import { Card } from '@/components/ui/card';
import { PartyPopper, Coins, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const SavingsCalculator = () => {
  const [eventsPerMonth, setEventsPerMonth] = useState([2]);
  
  // Assumptions
  const avgTicketPrice = 15;
  const avgDiscount = 5; // £5 off per event
  const membershipCost = 20;
  
  const monthlySavings = (eventsPerMonth[0] * avgDiscount) - membershipCost;
  const yearlySavings = (monthlySavings * 12);
  const isSaving = monthlySavings > 0;

  return (
    <section className="py-12 mb-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold mb-4">Calculate Your Savings</h2>
          <p className="text-muted-foreground">See how much you could save with a VIP membership</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Controls */}
            <Card className="p-8 bg-surface border-primary/20">
                <div className="space-y-8">
                    <div>
                        <div className="flex justify-between mb-4">
                            <label className="font-semibold">Events per month</label>
                            <span className="text-primary font-bold text-xl">{eventsPerMonth[0]}</span>
                        </div>
                        <Slider
                            value={eventsPerMonth}
                            onValueChange={setEventsPerMonth}
                            max={12}
                            step={1}
                            className="hover:cursor-grab active:cursor-grabbing"
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                            Average party/class entry: £{avgTicketPrice}
                        </p>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex justify-between text-sm">
                            <span>Monthly Cost (Standard)</span>
                            <span>£{eventsPerMonth[0] * avgTicketPrice}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold text-primary">
                            <span>VIP Membership</span>
                            <span>£{membershipCost}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>VIP Discounted Entry (£{avgTicketPrice - avgDiscount})</span>
                            <span>£{eventsPerMonth[0] * (avgTicketPrice - avgDiscount)}</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Result */}
            <div className="relative">
                <Card className={`p-8 text-center transition-colors duration-500 ${isSaving ? 'bg-primary/10 border-primary' : 'bg-muted border-border'}`}>
                    <h3 className="text-lg font-medium mb-2">Your Net Savings</h3>
                    <motion.div 
                        key={monthlySavings}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`text-5xl font-black mb-2 ${isSaving ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                        {monthlySavings > 0 ? `£${monthlySavings}` : `-£${Math.abs(monthlySavings)}`}
                    </motion.div>
                    <p className="text-sm text-muted-foreground mb-6">per month</p>

                    {isSaving && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-background/50 rounded-lg p-4 mb-6"
                        >
                            <p className="text-sm font-medium mb-1">That's <span className="text-primary font-bold">£{yearlySavings}</span> extra in your pocket per year!</p>
                            <p className="text-xs text-muted-foreground">Enough for a flight to a salsa festival ✈️</p>
                        </motion.div>
                    )}

                    <Button className="w-full gap-2" variant={isSaving ? "default" : "outline"}>
                        {isSaving ? "Start Saving Now" : "See Benefits"} <ArrowRight className="w-4 h-4" />
                    </Button>
                </Card>
                
                {isSaving && (
                    <motion.div 
                        className="absolute -top-4 -right-4 text-4xl"
                        initial={{ rotate: -20, scale: 0 }}
                        animate={{ rotate: 20, scale: 1 }}
                        transition={{ type: "spring" }}
                    >
                        🤑
                    </motion.div>
                )}
            </div>
        </div>
      </div>
    </section>
  );
};


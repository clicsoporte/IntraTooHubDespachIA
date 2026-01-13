"use client";

import React, { useState, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calculator, X } from 'lucide-react';

const CalculatorButton = ({
  onClick,
  children,
  className = '',
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) => (
  <Button
    variant="outline"
    className={`h-14 text-xl font-bold ${className}`}
    onClick={onClick}
  >
    {children}
  </Button>
);

export function QuickCalculator() {
  const [displayValue, setDisplayValue] = useState('0');
  const [operator, setOperator] = useState<string | null>(null);
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [clearOnNextInput, setClearOnNextInput] = useState(false);

  const inputDigit = useCallback((digit: string) => {
    if (clearOnNextInput) {
      setDisplayValue(digit);
      setClearOnNextInput(false);
    } else {
      setDisplayValue(displayValue === '0' ? digit : displayValue + digit);
    }
  }, [displayValue, clearOnNextInput]);

  const inputDecimal = useCallback(() => {
    if (!displayValue.includes('.')) {
      setDisplayValue(displayValue + '.');
    }
  }, [displayValue]);

  const performOperation = useCallback((nextOperator: string) => {
    const inputValue = parseFloat(displayValue);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operator) {
      const result = calculate(previousValue, inputValue, operator);
      setDisplayValue(String(result));
      setPreviousValue(result);
    }

    setClearOnNextInput(true);
    setOperator(nextOperator);
  }, [displayValue, operator, previousValue]);

  const calculate = (prev: number, current: number, op: string): number => {
    switch (op) {
      case '+':
        return prev + current;
      case '-':
        return prev - current;
      case '*':
        return prev * current;
      case '/':
        return prev / current;
      default:
        return current;
    }
  };

  const handleEquals = useCallback(() => {
    if (!operator || previousValue === null) return;
    const inputValue = parseFloat(displayValue);
    const result = calculate(previousValue, inputValue, operator);
    setDisplayValue(String(result));
    setPreviousValue(null);
    setOperator(null);
    setClearOnNextInput(true);
  }, [displayValue, operator, previousValue]);

  const clearCalculator = useCallback(() => {
    setDisplayValue('0');
    setOperator(null);
    setPreviousValue(null);
    setClearOnNextInput(false);
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon">
          <Calculator className="h-5 w-5" />
          <span className="sr-only">Abrir calculadora</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2">
        <div className="flex flex-col space-y-2">
          <div className="rounded-md border bg-muted p-4 text-right text-3xl font-mono">
            {displayValue}
          </div>
          <div className="grid grid-cols-4 gap-2">
            <CalculatorButton onClick={clearCalculator} className="col-span-2 bg-destructive text-destructive-foreground hover:bg-destructive/90">
              AC
            </CalculatorButton>
            <CalculatorButton onClick={() => {}} className="bg-secondary">
              <X className="h-6 w-6" />
            </CalculatorButton>
            <CalculatorButton onClick={() => performOperation('/')} className="bg-primary/80 hover:bg-primary/90 text-primary-foreground">
              /
            </CalculatorButton>

            <CalculatorButton onClick={() => inputDigit('7')}>7</CalculatorButton>
            <CalculatorButton onClick={() => inputDigit('8')}>8</CalculatorButton>
            <CalculatorButton onClick={() => inputDigit('9')}>9</CalculatorButton>
            <CalculatorButton onClick={() => performOperation('*')} className="bg-primary/80 hover:bg-primary/90 text-primary-foreground">
              *
            </CalculatorButton>

            <CalculatorButton onClick={() => inputDigit('4')}>4</CalculatorButton>
            <CalculatorButton onClick={() => inputDigit('5')}>5</CalculatorButton>
            <CalculatorButton onClick={() => inputDigit('6')}>6</CalculatorButton>
            <CalculatorButton onClick={() => performOperation('-')} className="bg-primary/80 hover:bg-primary/90 text-primary-foreground">
              -
            </CalculatorButton>

            <CalculatorButton onClick={() => inputDigit('1')}>1</CalculatorButton>
            <CalculatorButton onClick={() => inputDigit('2')}>2</CalculatorButton>
            <CalculatorButton onClick={() => inputDigit('3')}>3</CalculatorButton>
            <CalculatorButton onClick={() => performOperation('+')} className="bg-primary/80 hover:bg-primary/90 text-primary-foreground">
              +
            </CalculatorButton>

            <CalculatorButton onClick={() => inputDigit('0')} className="col-span-2">
              0
            </CalculatorButton>
            <CalculatorButton onClick={inputDecimal}>.</CalculatorButton>
            <CalculatorButton onClick={handleEquals} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              =
            </CalculatorButton>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

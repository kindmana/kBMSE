import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface MeasureLengthModalProps {
  isOpen: boolean;
  measure: number;
  currentLength: number;
  onClose: () => void;
  onApply: (measure: number, length: number) => void;
}

export const MeasureLengthModal: React.FC<MeasureLengthModalProps> = ({
  isOpen, measure, currentLength, onClose, onApply
}) => {
  const [decimalValue, setDecimalValue] = useState<string>(currentLength.toString());
  const [numerator, setNumerator] = useState<string>('');
  const [denominator, setDenominator] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setDecimalValue(currentLength.toString());
      
      // Calculate initial fraction
      let found = false;
      const commonDenoms = [4, 8, 16, 32, 64, 128, 192, 256, 384];
      for (const den of commonDenoms) {
        const num = Math.round(currentLength * den);
        if (Math.abs(num / den - currentLength) < 1e-6) {
          setNumerator(num.toString());
          setDenominator(den.toString());
          found = true;
          break;
        }
      }
      
      if (!found) {
        let bestNum = 1, bestDen = 1;
        let minError = Math.abs(currentLength - 1);
        for (let den = 1; den <= 1000; den++) {
          const num = Math.round(currentLength * den);
          const error = Math.abs(num / den - currentLength);
          if (error < minError) {
            bestNum = num;
            bestDen = den;
            minError = error;
            if (error < 1e-10) break;
          }
        }
        setNumerator(bestNum.toString());
        setDenominator(bestDen.toString());
      }
    }
  }, [isOpen, currentLength]);

  if (!isOpen) return null;

  const handleDecimalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valStr = e.target.value;
    setDecimalValue(valStr);
    
    const val = parseFloat(valStr);
    if (!isNaN(val) && val > 0) {
      // Update fraction fields by default assuming base 4
      const den = parseInt(denominator) || 4;
      const num = Math.round(val * den);
      setNumerator(num.toString());
    }
  };

  const handleFractionChange = (newNumStr: string, newDenStr: string) => {
    setNumerator(newNumStr);
    setDenominator(newDenStr);
    
    const num = parseFloat(newNumStr);
    const den = parseFloat(newDenStr);
    
    if (!isNaN(num) && !isNaN(den) && den !== 0) {
      setDecimalValue((num / den).toString());
    }
  };

  const handleApply = () => {
    const val = parseFloat(decimalValue);
    if (!isNaN(val) && val > 0) {
      onApply(measure, val);
      onClose();
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '20px',
        width: '300px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem' }}>Edit Measure #{measure.toString().padStart(3, '0')} Length</h3>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>Decimal</label>
          <input 
            type="number"
            step="0.015625"
            value={decimalValue}
            onChange={handleDecimalChange}
            style={{
              width: '100%',
              padding: '8px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              borderRadius: '4px'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '5px' }}>Fraction</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input 
              type="number"
              value={numerator}
              onChange={(e) => handleFractionChange(e.target.value, denominator)}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: '4px',
                textAlign: 'center'
              }}
            />
            <span>/</span>
            <input 
              type="number"
              value={denominator}
              onChange={(e) => handleFractionChange(numerator, e.target.value)}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: '4px',
                textAlign: 'center'
              }}
            />
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button 
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Cancel
          </button>
          <button 
            onClick={handleApply}
            style={{
              padding: '8px 16px',
              background: '#4a90e2',
              border: 'none',
              color: 'white',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

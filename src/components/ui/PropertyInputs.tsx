import { useRef } from 'react';

export const TextInput = ({ label, value, onChange }: any) => (
  <div className="property-item">
    <span className="property-label">{label}</span>
    <input 
      type="text" 
      className="property-value" 
      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.9rem', outline: 'none' }}
      value={value || ''} 
      onChange={(e) => onChange(e.target.value)} 
    />
  </div>
);

export const TextAreaInput = ({ label, value, onChange, rows = 2 }: any) => (
  <div className="property-item" style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'stretch' }}>
    <span className="property-label" style={{ marginBottom: '2px' }}>{label}</span>
    <textarea 
      rows={rows}
      className="property-value" 
      style={{ 
        background: 'var(--bg-secondary)', 
        color: 'var(--text-primary)', 
        border: '1px solid var(--border-color)', 
        borderRadius: '4px', 
        padding: '6px 8px', 
        fontSize: '0.9rem', 
        outline: 'none',
        fontFamily: 'inherit',
        resize: 'vertical',
        width: '100%'
      }}
      value={value || ''} 
      onChange={(e) => onChange(e.target.value)} 
    />
  </div>
);


export const NumberInput = ({ label, value, onChange, isFloat = false, min, max }: any) => (
  <div className="property-item">
    <span className="property-label">{label}</span>
    <input 
      type="number" 
      step={isFloat ? "0.01" : "1"}
      min={min}
      max={max}
      className="property-value" 
      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.9rem', outline: 'none' }}
      value={value ?? ''} 
      onChange={(e) => {
        const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
        onChange(isNaN(val) ? undefined : val);
      }} 
    />
  </div>
);

export const SelectInput = ({ label, value, onChange, options }: any) => (
  <div className="property-item">
    <span className="property-label">{label}</span>
    <select 
      className="property-value"
      style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.9rem', outline: 'none' }}
      value={value ?? ''}
      onChange={(e) => {
        const val = e.target.value;
        if (val === '') onChange(undefined);
        else onChange(isNaN(Number(val)) ? val : Number(val));
      }}
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  </div>
);

export const FileInput = ({ label, value, onChange }: any) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  return (
    <div className="property-item">
      <span className="property-label">{label}</span>
      <div style={{ display: 'flex', gap: '4px' }}>
        <input 
          type="text" 
          className="property-value" 
          style={{ flex: 1, width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.9rem', outline: 'none' }}
          value={value || ''} 
          onChange={(e) => onChange(e.target.value)} 
          placeholder="Filename"
        />
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onChange(e.target.files[0].name);
            }
          }}
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '0 8px', cursor: 'pointer' }}
        >
          ...
        </button>
      </div>
    </div>
  );
};

export const LnObjInput = ({ label, value, onChange }: any) => {
  return (
    <div className="property-item">
      <span className="property-label" title="Base36 only (01-ZZ)">{label}</span>
      <input 
        type="text" 
        className="property-value" 
        style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.9rem', outline: 'none' }}
        value={value || ''} 
        onChange={(e) => {
          let val = e.target.value.toUpperCase();
          val = val.replace(/[^0-9A-Z]/g, '').substring(0, 2);
          onChange(val);
        }} 
        placeholder="00"
      />
    </div>
  );
};

export const HexInput = ({ label, value, onChange }: any) => {
  return (
    <div className="property-item">
      <span className="property-label">{label}</span>
      <input 
        type="text" 
        className="property-value" 
        style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', fontSize: '0.9rem', outline: 'none' }}
        value={value ? value.toString(16).padStart(2, '0').toUpperCase() : ''} 
        onChange={(e) => {
          const val = parseInt(e.target.value, 16);
          onChange(isNaN(val) ? undefined : val);
        }} 
      />
    </div>
  );
};

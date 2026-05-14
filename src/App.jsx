import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from './supabaseClient';
import { CheckCircle2, Truck, AlertCircle, Check, X, ArrowRight, Search, FileText, PlusCircle, MapPin, Calendar, Image as ImageIcon, PackageCheck, Undo2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

function App() {
  const [view, setView] = useState('register'); // 'register', 'lookup', 'return'
  const [step, setStep] = useState(0); 
  const [ofNumber, setOfNumber] = useState('');
  const [intento, setIntento] = useState(null);
  const [rechazo, setRechazo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Estados para la consulta
  const [lookupResult, setLookupResult] = useState(null);
  const [associatedMail, setAssociatedMail] = useState('');
  const [apiGestiones, setApiGestiones] = useState([]);
  const [ofData, setOfData] = useState(null);
  const [subView, setSubView] = useState('devolucion');

  // Estados para Dirección Incorrecta (TDEVCODIGO = 3)
  const [isDirIncorrectaFlow, setIsDirIncorrectaFlow] = useState(false);
  const [direccionActual, setDireccionActual] = useState(null);
  const [dirCorrecta, setDirCorrecta] = useState(null);
  const [nuevaDireccion, setNuevaDireccion] = useState('');
  const [nuevaNumeracion, setNuevaNumeracion] = useState('');
  const [nuevaComuna, setNuevaComuna] = useState('');
  const [nuevaRegion, setNuevaRegion] = useState('');
  const [comunasList, setComunasList] = useState([]);
  const [regionesList, setRegionesList] = useState([]);
  const [ciudadesList, setCiudadesList] = useState([]);
  const [mapCoords, setMapCoords] = useState(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  
  // Estados para Devolución
  const [returnStep, setReturnStep] = useState(0);
  const [returnForm, setReturnForm] = useState({
    motivo: '',
    familia: '',
    estadoEmbalaje: '',
    armado: '',
    tipoEmbalaje: '',
    tipoLi: '',
    condiciones: [],
    region: '',
    comuna: '',
    agencia: null
  });
  const [catalogs, setCatalogs] = useState({
    motivos: [],
    familias: [],
    estadosEmbalaje: [],
    armado: [],
    tiposEmbalaje: [],
    condiciones: [],
    tiposLi: []
  });
  const [rulesMatrix, setRulesMatrix] = useState([]);
  const [familyConditions, setFamilyConditions] = useState([]);
  const [agenciasList, setAgenciasList] = useState([]);
  const [mapCenter, setMapCenter] = useState([-33.4489, -70.6693]); // Santiago por defecto

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const [reg, com, ciu] = await Promise.all([
          supabase.from('MA_REGION').select('*'),
          supabase.from('MA_COMUNA').select('*'),
          supabase.from('MA_CIUDAD').select('*')
        ]);
        
        if (reg.error) console.error("Error cargando regiones:", reg.error);
        if (com.error) console.error("Error cargando comunas:", com.error);
        
        console.log("[DEBUG] Ubicaciones cargadas:", { regiones: reg.data?.length, comunas: com.data?.length });
        
        setRegionesList(reg.data || []);
        setComunasList(com.data || []);
        setCiudadesList(ciu.data || []);

        if (reg.data && reg.data.length > 0) {
          console.log("[DEBUG] Estructura de MA_REGION:", Object.keys(reg.data[0]).join(", "));
        }
        if (com.data && com.data.length > 0) {
          console.log("[DEBUG] Estructura de MA_COMUNA:", Object.keys(com.data[0]).join(", "));
        }
        if (ciu.data && ciu.data.length > 0) {
          console.log("[DEBUG] Estructura de MA_CIUDAD:", Object.keys(ciu.data[0]).join(", "));
        }
      } catch (e) {
        console.error("Error crítico en fetchLocations:", e);
      }
    };
    fetchLocations();
  }, []);

  useEffect(() => {
    if (dirCorrecta === 'no' && nuevaDireccion && nuevaNumeracion && nuevaComuna) {
      const fetchCoords = async () => {
        setIsGeocoding(true);
        try {
          const comunaName = comunasList.find(c => c.COMUCODIGO.toString() === nuevaComuna)?.COMUNOMBRE || '';
          const query = `${nuevaDireccion} ${nuevaNumeracion}, ${comunaName}, Chile`;
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
          const data = await res.json();
          if (data && data.length > 0) {
            setMapCoords([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
          } else {
            setMapCoords(null);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsGeocoding(false);
        }
      };
      
      const timeoutId = setTimeout(fetchCoords, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [nuevaDireccion, nuevaNumeracion, nuevaComuna, dirCorrecta, comunasList]);

  useEffect(() => {
    const fetchCatalogs = async () => {
      try {
        const results = await Promise.all([
          supabase.from('MA_MOTIVOS_DEVOLUCION').select('*'),
          supabase.from('MA_FAMILIA_PRODUCTO').select('*'),
          supabase.from('MA_ESTADO_EMBALAJE').select('*'),
          supabase.from('MA_TIPO_AMARDO').select('*'),
          supabase.from('MA_TIPO_EMBALAJE').select('*'),
          supabase.from('MA_CONDICIONES_PRODUCTO').select('*'),
          supabase.from('RL_MATRIZ_PROD_DEV').select('*'),
          supabase.from('RL_FAMILA_CONDICION').select('*'),
          supabase.from('MA_TIPO_LI').select('*')
        ]);

        // Log de errores por tabla
        results.forEach((res, i) => {
          if (res.error) console.error(`Error en tabla ${i}:`, res.error);
        });

        const [motivos, familias, estados, armado, tipos, condiciones, rules, famCond, tipoLi] = results;

        setCatalogs({
          motivos: motivos.data || [],
          familias: familias.data || [],
          estadosEmbalaje: estados.data || [],
          armado: armado.data || [],
          tiposEmbalaje: tipos.data || [],
          condiciones: condiciones.data || [],
          tiposLi: tipoLi.data || []
        });
        console.log("[DEBUG] Catálogos cargados:", {
          motivos: motivos.data,
          familias: familias.data,
          estados: estados.data,
          tipoLi: tipoLi.data
        });
        setRulesMatrix(rules.data || []);
        setFamilyConditions(famCond.data || []);
        
        if (results.some(r => r.error)) {
          setError("Error parcial cargando tablas. Revisa las políticas RLS en Supabase.");
        }
      } catch (e) {
        console.error("Error crítico cargando catálogos:", e);
        setError("Error de conexión con Supabase.");
      }
    };

    fetchCatalogs();
  }, []);

  useEffect(() => {
    if (view === 'return' && returnForm.comuna) {
      const fetchAgencias = async () => {
        // Probamos con COMUCODIGO y COMCODIGO
        let { data } = await supabase
          .from('MA_AGENCIA')
          .select('*')
          .eq('COMUCODIGO', returnForm.comuna);
        
        if (!data || data.length === 0) {
          const secondTry = await supabase
            .from('MA_AGENCIA')
            .select('*')
            .eq('COMCODIGO', returnForm.comuna);
          data = secondTry.data;
        }
        
        if (data && data.length > 0) {
          console.log("[DEBUG] Estructura de MA_AGENCIA:", Object.keys(data[0]).join(", "));
        }

        const validAgencias = (data || []).filter(a => {
          const lat = getVal(a, ['LATITUD', 'LAT']);
          const lon = getVal(a, ['LONGITUD', 'LON', 'LONG']);
          return lat && lon && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lon));
        });
        
        console.log(`[DEBUG] Agencias válidas encontradas en ${returnForm.comuna}:`, validAgencias.length);
        setAgenciasList(validAgencias);
        
        if (validAgencias.length > 0) {
          const firstLat = parseFloat(getVal(validAgencias[0], ['LATITUD', 'LAT']));
          const firstLon = parseFloat(getVal(validAgencias[0], ['LONGITUD', 'LON', 'LONG']));
          setMapCenter([firstLat, firstLon]);
        }
      };
      fetchAgencias();
    } else {
      setAgenciasList([]);
    }
  }, [returnForm.comuna, view]);

  const getVal = (obj, keys) => {
    if (!obj) return '';
    // Buscar coincidencia exacta, ignorando case y espacios
    const allObjKeys = Object.keys(obj);
    for (const k of keys) {
      const found = allObjKeys.find(ok => ok.trim().toLowerCase() === k.trim().toLowerCase());
      if (found) return obj[found];
    }
    // Si no hay coincidencia exacta, buscar cualquier key que contenga la palabra clave
    for (const k of keys) {
      const found = allObjKeys.find(ok => ok.toLowerCase().includes(k.toLowerCase()));
      if (found) return obj[found];
    }
    return '';
  };

  const getAvailableOptions = (fieldName) => {
    switch(fieldName) {
      case 'familia': return catalogs.familias;
      case 'motivo': return catalogs.motivos;
      case 'estadoEmbalaje': return catalogs.estadosEmbalaje;
      case 'armado': return catalogs.armado;
      case 'tipoEmbalaje': return catalogs.tiposEmbalaje;
      case 'condiciones': return catalogs.condiciones;
      case 'tipoLi': return catalogs.tiposLi;
      default: return [];
    }
  };

  const handleNext = async (e) => {
    e.preventDefault();
    if (!ofNumber) return setError('Por favor ingresa un número de OF');
    setLoading(true);
    setError(null);
    try {
      const { data: ofD, error: ofE } = await supabase
        .from('ORDEN_FLETE')
        .select('TDEVCODIGO, DIRECCION, Numeracion, CIUDCODIGO, COMUCODIGO')
        .eq('ODFLCODIGO', parseInt(ofNumber))
        .single();
      if (ofE || !ofD) throw new Error('Número de OF no encontrado');

      const { data: existingAnswers } = await supabase
        .from('MV_RESPUESTA_ENCUESTA')
        .select('OF')
        .eq('OF', parseInt(ofNumber))
        .limit(1);
      
      if (existingAnswers && existingAnswers.length > 0) {
        throw new Error('Esta OF ya fue gestionada. Dirígete a la pestaña CONSULTAR para ver sus detalles.');
      }

      setIsDirIncorrectaFlow(false);
      setDireccionActual(null);
      setDirCorrecta(null);
      setMapCoords(null);
      setNuevaDireccion('');
      setNuevaNumeracion('');
      setNuevaComuna('');
      setNuevaRegion('');

      if (ofD.TDEVCODIGO === 3) {
        setIsDirIncorrectaFlow(true);
        const { data: dComuna } = await supabase.from('MA_COMUNA').select('COMUNOMBRE').eq('COMUCODIGO', ofD.COMUCODIGO).single();
        const { data: dCiudad } = await supabase.from('MA_CIUDAD').select('CIUDNOMBRE, CIUDREGION').eq('CIUDCODIGO', ofD.CIUDCODIGO).single();
        let regionName = '';
        if (dCiudad && dCiudad.CIUDREGION) {
          const { data: dRegion } = await supabase.from('MA_REGION').select('REGNOMBRE').eq('REGCODIGO', dCiudad.CIUDREGION).single();
          regionName = dRegion?.REGNOMBRE;
        }
        
        setDireccionActual({
          calle: ofD.DIRECCION,
          numero: ofD.Numeracion,
          comuna: dComuna?.COMUNOMBRE,
          ciudad: dCiudad?.CIUDNOMBRE,
          region: regionName
        });

        const { data: allRegiones } = await supabase.from('MA_REGION').select('REGCODIGO, REGNOMBRE').order('REGNOMBRE');
        if (allRegiones) setRegionesList(allRegiones);

        const { data: allCiudades } = await supabase.from('MA_CIUDAD').select('CIUDCODIGO, CIUDREGION');
        if (allCiudades) setCiudadesList(allCiudades);

        const { data: allComunas } = await supabase.from('MA_COMUNA').select('COMUCODIGO, COMUNOMBRE, CIUDCODIGO').order('COMUNOMBRE');
        if (allComunas) setComunasList(allComunas);
        
        setStep(3); // Avanzar a vista del mapa en NUEVA
      } else {
        const { data: devD, error: devE } = await supabase
          .from('MA_TIPO_DEVOLUCION')
          .select('IsRechazo')
          .eq('id', ofD.TDEVCODIGO)
          .single();
        if (devE || !devD || !devD.IsRechazo) throw new Error('Esta OF no puede ser gestionada');
        setStep(1); // Avanzar a vista de intento/rechazo en NUEVA
      }
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const { error: dbError } = await supabase
        .from('MV_RESPUESTA_ENCUESTA')
        .insert([
          { OF: parseInt(ofNumber), TIPO_CAMPO: 1, DESCRIPCION: 'CONFIRMAR_INTENTO', VALOR: intento.toUpperCase(), confirmacion: now, created_at: now, modificacion: now },
          { OF: parseInt(ofNumber), TIPO_CAMPO: 2, DESCRIPCION: 'CONFIRMAR_RECHAZO', VALOR: rechazo.toUpperCase(), confirmacion: now, created_at: now, modificacion: now }
        ]);
      if (dbError) throw dbError;
      setStep(2);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!ofNumber) return setError('Ingresa una OF para buscar');
    setLoading(true);
    setError(null);
    setLookupResult(null);
    setApiGestiones([]);
    setOfData(null);
    
    try {
      // 1. Buscamos mail, IDDEV e IDENTR en ORDEN_FLETE
      const { data: dOf, error: eOf } = await supabase
        .from('ORDEN_FLETE')
        .select('mail, IDDEV, IDENTR')
        .eq('ODFLCODIGO', parseInt(ofNumber))
        .single();

      if (eOf || !dOf) throw new Error('OF no encontrada en la base de datos');
      setOfData(dOf);
      setAssociatedMail(dOf.mail);

      // 2. Buscamos las respuestas en MV_RESPUESTA_ENCUESTA
      const { data: dEnc, error: eEnc } = await supabase
        .from('MV_RESPUESTA_ENCUESTA')
        .select('*')
        .eq('OF', parseInt(ofNumber))
        .order('TIPO_CAMPO', { ascending: true });
      
      if (!dEnc || dEnc.length === 0) throw new Error('No se encontraron gestiones para esta OF');
      
      const comunaAnswer = dEnc.find(r => r.TIPO_CAMPO === 5);
      if (comunaAnswer && !isNaN(parseInt(comunaAnswer.VALOR))) {
        const { data: comunaData } = await supabase.from('MA_COMUNA').select('COMUNOMBRE').eq('COMUCODIGO', parseInt(comunaAnswer.VALOR)).single();
        if (comunaData) {
          comunaAnswer.VALOR = comunaData.COMUNOMBRE;
        }
      }

      setLookupResult(dEnc);

      // 3. API STAKEN (con logs completos de diagnóstico)
      try {
        const requestBody = { codigoOrdenFlete: parseInt(ofNumber) };
        console.log("[API PDA] Enviando request:", requestBody);

        const response = await fetch('https://restservices-qa.starken.cl/apiqa/starkenservices/rest/consultarLinkImagenFotosPDAAcuso', {
          method: 'POST',
          headers: { 'rut': 'CHN_TCK', 'clave': 'Starken2026', 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        console.log("[API PDA] Status HTTP:", response.status, response.statusText);
        
        const rawText = await response.text();
        console.log("[API PDA] Respuesta RAW:", rawText);

        try {
          const res = JSON.parse(rawText);
          console.log("[API PDA] JSON Parseado:", res);
          console.log("[API PDA] gestiones:", res?.gestiones);
          if (res && res.gestiones) {
            setApiGestiones(res.gestiones);
            console.log("[API PDA] Total gestiones cargadas:", res.gestiones.length);
          } else {
            console.warn("[API PDA] No se encontró el campo 'gestiones' en la respuesta");
          }
        } catch (parseErr) {
          console.error("[API PDA] Error al parsear JSON:", parseErr);
        }
      } catch (apiErr) {
        console.error("[API PDA] Error de red/CORS:", apiErr);
      }
    } catch (err) { 
      setError(err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const getFilteredGestion = (type) => {
    if (!ofData || !apiGestiones.length) return null;
    const targetId = type === 'devolucion' ? 2 : 1;
    const targetCode = type === 'devolucion' ? parseInt(ofData.IDDEV) : parseInt(ofData.IDENTR);
    
    if (!targetCode) return null;

    const match = apiGestiones.find(g => 
      g.idGestion === targetId && g.codigoProcesoDevolucionOEntrega === targetCode
    );

    if (!match) return null;
    return {
      fecha: match.fechaGestion,
      coordenadas: match.coordenadas,
      status: match.descripcionGestion,
      fotos: (match.fotografias || []).map(f => ({
        url: f.url.startsWith('http') ? f.url : `https://${f.url}`,
        desc: f.descripcion
      }))
    };
  };

  const devGestion = getFilteredGestion('devolucion');
  const entGestion = getFilteredGestion('entrega');

  const handleSaveDir = async (e) => {
    e.preventDefault();
    if (dirCorrecta === 'no' && (!nuevaDireccion || !nuevaNumeracion || !nuevaComuna)) {
      return setError('Completa todos los campos de la nueva dirección');
    }
    setLoading(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      const inserts = [
        { OF: parseInt(ofNumber), TIPO_CAMPO: 3, DESCRIPCION: 'CONFIRMA_DIRECCION', VALOR: dirCorrecta.toUpperCase(), confirmacion: now, created_at: now, modificacion: now }
      ];
      
      if (dirCorrecta === 'no') {
        inserts.push({ OF: parseInt(ofNumber), TIPO_CAMPO: 4, DESCRIPCION: 'NUEVA_DIRECCION', VALOR: nuevaDireccion, confirmacion: now, created_at: now, modificacion: now });
        inserts.push({ OF: parseInt(ofNumber), TIPO_CAMPO: 5, DESCRIPCION: 'NUEVA_COMUNA', VALOR: nuevaComuna, confirmacion: now, created_at: now, modificacion: now });
        inserts.push({ OF: parseInt(ofNumber), TIPO_CAMPO: 6, DESCRIPCION: 'NUEVA_NUMERACION', VALOR: nuevaNumeracion, confirmacion: now, created_at: now, modificacion: now });
      }

      const { error: dbError } = await supabase.from('MV_RESPUESTA_ENCUESTA').insert(inserts);
      if (dbError) throw dbError;
      
      setStep(2); // Pantalla de éxito
      setView('register');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const inserts = [];
      
      if (returnForm.motivo) inserts.push({ OF: parseInt(ofNumber), TIPO_CAMPO: 7, DESCRIPCION: 'MOTIVO_DEVOLUCION', VALOR: returnForm.motivo, confirmacion: now, created_at: now, modificacion: now });
      if (returnForm.familia) inserts.push({ OF: parseInt(ofNumber), TIPO_CAMPO: 8, DESCRIPCION: 'FAMILIA_PRODUCTO', VALOR: returnForm.familia, confirmacion: now, created_at: now, modificacion: now });
      if (returnForm.estadoEmbalaje) inserts.push({ OF: parseInt(ofNumber), TIPO_CAMPO: 9, DESCRIPCION: 'ESTADO_EMBALAJE', VALOR: returnForm.estadoEmbalaje, confirmacion: now, created_at: now, modificacion: now });
      if (returnForm.armado) inserts.push({ OF: parseInt(ofNumber), TIPO_CAMPO: 10, DESCRIPCION: 'ARMADO', VALOR: returnForm.armado, confirmacion: now, created_at: now, modificacion: now });
      if (returnForm.tipoEmbalaje) inserts.push({ OF: parseInt(ofNumber), TIPO_CAMPO: 11, DESCRIPCION: 'TIPO_EMBALAJE', VALOR: returnForm.tipoEmbalaje, confirmacion: now, created_at: now, modificacion: now });
      if (returnForm.tipoLi) inserts.push({ OF: parseInt(ofNumber), TIPO_CAMPO: 13, DESCRIPCION: 'TIPO_DEVOLUCION', VALOR: returnForm.tipoLi, confirmacion: now, created_at: now, modificacion: now });
      if (returnForm.agencia) inserts.push({ OF: parseInt(ofNumber), TIPO_CAMPO: 14, DESCRIPCION: 'AGENCIA_STARKEN', VALOR: returnForm.agencia.AGENCODI, confirmacion: now, created_at: now, modificacion: now });
      
      if (returnForm.condiciones.length > 0) {
        inserts.push({ 
          OF: parseInt(ofNumber), 
          TIPO_CAMPO: 12, 
          DESCRIPCION: 'CONDICION_PRODUCTO', 
          VALOR: returnForm.condiciones.join(','), 
          confirmacion: now, 
          created_at: now, 
          modificacion: now 
        });
      }

      const { error: dbError } = await supabase.from('MV_RESPUESTA_ENCUESTA').insert(inserts);
      if (dbError) throw dbError;
      
      setReturnStep(2); // Éxito
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleNextReturn = async (e) => {
    e.preventDefault();
    if (!ofNumber) return setError('Por favor ingresa un número de OF');
    setLoading(true);
    setError(null);
    try {
      const { data: ofD, error: ofE } = await supabase
        .from('ORDEN_FLETE')
        .select('ODFLCODIGO')
        .eq('ODFLCODIGO', parseInt(ofNumber));
      
      if (ofE || !ofD || ofD.length === 0) throw new Error('Número de OF no encontrado');
      
      setReturnStep(1);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const handleReset = () => {
    setOfNumber(''); setIntento(null); setRechazo(null); setStep(0);
    setError(null); setLookupResult(null); setApiGestiones([]); setOfData(null);
    setIsDirIncorrectaFlow(false); setDireccionActual(null); setDirCorrecta(null);
    setNuevaDireccion(''); setNuevaNumeracion(''); setNuevaComuna(''); setNuevaRegion(''); setMapCoords(null);
    setReturnStep(0);
    setReturnForm({
      motivo: '',
      familia: '',
      estadoEmbalaje: '',
      armado: '',
      tipoEmbalaje: '',
      condiciones: []
    });
  };

  const filteredComunas = nuevaRegion ? comunasList.filter(c => {
    const ciudad = ciudadesList.find(ci => ci.CIUDCODIGO === c.CIUDCODIGO);
    return ciudad && ciudad.CIUDREGION.toString() === nuevaRegion;
  }) : comunasList;

  return (
    <div className="form-card">
      <div className="header">
        <h1 style={{ letterSpacing: '-1.5px' }}>starken</h1>
        <div className="tab-container">
          <button className={`tab-btn ${view === 'register' ? 'active' : ''}`} onClick={() => { setView('register'); handleReset(); }}><PlusCircle size={16} /> NUEVA</button>
          <button className={`tab-btn ${view === 'return' ? 'active' : ''}`} onClick={() => { setView('return'); handleReset(); }}><Undo2 size={16} /> DEVOLUCIÓN</button>
          <button className={`tab-btn ${view === 'lookup' ? 'active' : ''}`} onClick={() => { setView('lookup'); handleReset(); }}><Search size={16} /> CONSULTAR</button>
        </div>
      </div>

      <div className="content">
        <AnimatePresence mode="wait">
          {view === 'return' ? (
            /* --- DEVOLUCIÓN --- */
            returnStep === 0 ? (
              <motion.form key="ret0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleNextReturn}>
                <div className="field-group"><label className="label">Ingresar OF para devolución</label>
                  <input type="number" value={ofNumber} onChange={(e) => setOfNumber(e.target.value)} />
                </div>
                <button className="submit-btn" type="submit" disabled={loading}>{loading ? 'VALIDANDO...' : 'SIGUIENTE'}</button>
                {error && <p className="error-text">{error}</p>}
              </motion.form>
            ) : returnStep === 1 ? (
              <motion.form key="ret1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSubmitReturn}>
                {error && <div className="error-text" style={{ background: '#fff1f2', padding: '10px', borderRadius: '8px', marginBottom: '15px' }}>⚠️ {error}</div>}
                <div className="info-box">OF: {ofNumber}</div>
                
                {/* Familia */}
                <div className="field-group"><label className="label">Familia de Producto</label>
                  <select value={returnForm.familia} onChange={(e) => setReturnForm({...returnForm, familia: e.target.value})}>
                    <option value="">Selecciona una familia...</option>
                    {getAvailableOptions('familia').map((f, i) => <option key={getVal(f, ['id', 'ID', 'CODIGO', 'FAMICODIGO']) || i} value={getVal(f, ['id', 'ID', 'CODIGO', 'FAMICODIGO'])}>{getVal(f, ['nombre', 'descripcion', 'FAMIDESCRIPCION'])}</option>)}
                  </select>
                </div>

                {/* Motivo */}
                <div className="field-group"><label className="label">Motivo de Devolución</label>
                  <select value={returnForm.motivo} onChange={(e) => setReturnForm({...returnForm, motivo: e.target.value})}>
                    <option value="">Selecciona un motivo...</option>
                    {getAvailableOptions('motivo').map((m, i) => <option key={getVal(m, ['id', 'ID', 'CODIGO', 'MOTICODIGO']) || i} value={getVal(m, ['id', 'ID', 'CODIGO', 'MOTICODIGO'])}>{getVal(m, ['nombre', 'descripcion', 'MOTIDESCRIPCION'])}</option>)}
                  </select>
                </div>

                {/* Estado Embalaje */}
                <div className="field-group"><label className="label">Estado del Embalaje</label>
                  <select value={returnForm.estadoEmbalaje} onChange={(e) => setReturnForm({...returnForm, estadoEmbalaje: e.target.value})}>
                    <option value="">Selecciona un estado...</option>
                    {getAvailableOptions('estadoEmbalaje').map((e, i) => <option key={getVal(e, ['id', 'ID', 'CODIGO', 'ESTA_CODIGO']) || i} value={getVal(e, ['id', 'ID', 'CODIGO', 'ESTA_CODIGO'])}>{getVal(e, ['nombre', 'descripcion', 'ESTADODESCRIPCION'])}</option>)}
                  </select>
                </div>

                {/* Armado (Condicional: Solo Muebles) */}
                {catalogs.familias.find(f => getVal(f, ['id', 'ID'])?.toString() === returnForm.familia)?.nombre === 'Mueble' && (
                  <div className="field-group"><label className="label">Armado</label>
                    <select value={returnForm.armado} onChange={(e) => setReturnForm({...returnForm, armado: e.target.value})}>
                      <option value="">Selecciona...</option>
                      {getAvailableOptions('armado').map(a => <option key={getVal(a, ['id', 'ID'])} value={getVal(a, ['id', 'ID'])}>{getVal(a, ['nombre', 'descripcion'])}</option>)}
                    </select>
                  </div>
                )}

                {/* Tipo Embalaje */}
                <div className="field-group"><label className="label">Tipo de Embalaje</label>
                  <select value={returnForm.tipoEmbalaje} onChange={(e) => setReturnForm({...returnForm, tipoEmbalaje: e.target.value})}>
                    <option value="">Selecciona un tipo...</option>
                    {getAvailableOptions('tipoEmbalaje').map(t => <option key={getVal(t, ['id', 'ID'])} value={getVal(t, ['id', 'ID'])}>{getVal(t, ['nombre', 'descripcion'])}</option>)}
                  </select>
                </div>

                {/* Condición del Producto (Checkboxes) */}
                <div className="field-group">
                  <label className="label">Condición del Producto</label>
                  <div className="checkbox-grid">
                    {getAvailableOptions('condiciones').map(c => (
                      <label key={getVal(c, ['id', 'ID'])} className="checkbox-item">
                        <input type="checkbox" checked={returnForm.condiciones.includes(getVal(c, ['id', 'ID']))} 
                          onChange={(e) => {
                            const cId = getVal(c, ['id', 'ID']);
                            const newConds = e.target.checked 
                              ? [...returnForm.condiciones, cId]
                              : returnForm.condiciones.filter(id => id !== cId);
                            setReturnForm({...returnForm, condiciones: newConds});
                          }} 
                        />
                        <span>{getVal(c, ['nombre', 'descripcion'])}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Tipo de Devolución */}
                <div className="field-group"><label className="label">Tipo de Devolución</label>
                  <select value={returnForm.tipoLi} onChange={(e) => setReturnForm({...returnForm, tipoLi: e.target.value})}>
                    <option value="">Selecciona tipo...</option>
                    {getAvailableOptions('tipoLi').map(t => <option key={getVal(t, ['id', 'ID'])} value={getVal(t, ['id', 'ID'])}>{getVal(t, ['descripcion', 'nombre'])}</option>)}
                  </select>
                </div>

                {/* --- SECCIÓN DROP-OFF (MAPA) --- */}
                {returnForm.tipoLi === '1' && (
                  <div className="dropoff-section" style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '0.9rem', marginBottom: '15px', color: 'var(--starken-green)' }}>Selecciona Agencia de Entrega</h3>
                    
                    <div className="field-group">
                      <label className="label">Región</label>
                      <select value={returnForm.region} onChange={(e) => setReturnForm({...returnForm, region: e.target.value, comuna: '', agencia: null})}>
                        <option value="">Selecciona región...</option>
                        {regionesList.map((r, i) => <option key={getVal(r, ['REGCODIGO', 'REGI_CODIGO', 'codigo', 'id']) || i} value={getVal(r, ['REGCODIGO', 'REGI_CODIGO', 'codigo', 'id'])}>{getVal(r, ['REGNOMBRE', 'REGION_NOMBRE', 'nombre', 'descripcion'])}</option>)}
                      </select>
                    </div>

                    <div className="field-group">
                      <label className="label">Comuna</label>
                      <select value={returnForm.comuna} onChange={(e) => setReturnForm({...returnForm, comuna: e.target.value, agencia: null})}>
                        <option value="">Selecciona comuna...</option>
                        {comunasList.filter(c => {
                          const cId = getVal(c, ['CIUDCODIGO', 'CIUCODIGO', 'id']);
                          if (!cId) return false;
                          const ciudad = ciudadesList.find(city => getVal(city, ['CIUDCODIGO', 'CIUCODIGO', 'id'])?.toString() === cId.toString());
                          // El vínculo en la tabla Ciudad es CIUDREGION
                          const regId = ciudad ? getVal(ciudad, ['CIUDREGION', 'REGCODIGO', 'id']) : null;
                          return regId?.toString() === returnForm.region;
                        }).map((c, i) => <option key={getVal(c, ['COMUCODIGO', 'COMCODIGO', 'id']) || i} value={getVal(c, ['COMUCODIGO', 'COMCODIGO', 'id'])}>{getVal(c, ['COMUNOMBRE', 'COMNOMBRE', 'nombre', 'descripcion'])}</option>)}
                      </select>
                    </div>

                    {returnForm.comuna && (
                      <>
                        <div className="map-wrapper" style={{ height: '300px', borderRadius: '12px', overflow: 'hidden', marginTop: '15px', border: '2px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%' }}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                            <MapUpdater center={mapCenter} />
                            {agenciasList.map(ag => {
                              const lat = parseFloat(getVal(ag, ['LATITUD', 'LAT']));
                              const lon = parseFloat(getVal(ag, ['LONGITUD', 'LON', 'LONG']));
                              
                              return (
                                <Marker 
                                  key={getVal(ag, ['AGENCODI', 'id'])} 
                                  position={[lat, lon]}
                                  icon={L.divIcon({
                                    className: 'custom-marker',
                                    html: `<div style="background: ${getVal(ag, ['AGENCODI', 'id']) === returnForm.agencia?.AGENCODI ? '#ff0000' : 'var(--starken-green)'}; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.3); transition: all 0.3s;"></div>`,
                                    iconSize: [14, 14]
                                  })}
                                  eventHandlers={{
                                    click: () => setReturnForm({...returnForm, agencia: ag})
                                  }}
                                >
                                  <Popup>
                                    <div style={{ padding: '5px' }}>
                                      <strong style={{ color: 'var(--starken-green)' }}>{getVal(ag, ['AGENNOMBRE', 'AGENDESCRIPCION', 'AGENNEMONICO']) || `Agencia ${getVal(ag, ['AGENCODI', 'id'])}`}</strong>
                                      <p style={{ margin: '5px 0', fontSize: '0.75rem', color: '#666' }}>{getVal(ag, ['AGENDIRECCION', 'direccion'])}</p>
                                      <button 
                                        onClick={() => setReturnForm({...returnForm, agencia: ag})}
                                        style={{ width: '100%', padding: '6px', background: 'var(--starken-green)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 'bold' }}
                                      >
                                        SELECCIONAR
                                      </button>
                                    </div>
                                  </Popup>
                                </Marker>
                              );
                            })}
                          </MapContainer>
                        </div>

                        {/* Listado de Agencias */}
                        <div className="agencias-list" style={{ marginTop: '15px', maxHeight: '250px', overflowY: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white' }}>
                          {agenciasList.length > 0 ? (
                            agenciasList.map(ag => {
                              const isSelected = getVal(ag, ['AGENCODI', 'id']) === returnForm.agencia?.AGENCODI;
                              return (
                                <div 
                                  key={getVal(ag, ['AGENCODI', 'id'])}
                                  onClick={() => {
                                    setReturnForm({...returnForm, agencia: ag});
                                    const lat = parseFloat(getVal(ag, ['LATITUD', 'LAT']));
                                    const lon = parseFloat(getVal(ag, ['LONGITUD', 'LON', 'LONG']));
                                    setMapCenter([lat, lon]);
                                  }}
                                  style={{ 
                                    padding: '12px 15px', 
                                    borderBottom: '1px solid #f1f5f9', 
                                    cursor: 'pointer',
                                    background: isSelected ? '#f0fdf4' : 'transparent',
                                    borderLeft: isSelected ? '4px solid var(--starken-green)' : '4px solid transparent',
                                    transition: 'all 0.2s'
                                  }}
                                >
                                  <div style={{ fontWeight: 'bold', fontSize: '0.85rem', color: isSelected ? 'var(--starken-green)' : '#1e293b' }}>
                                    {getVal(ag, ['AGENNOMBRE', 'AGENDESCRIPCION', 'AGENNEMONICO'])}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                                    📍 {getVal(ag, ['AGENDIRECCION', 'direccion']) || 'Dirección no disponible'}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                              No se encontraron agencias en esta comuna.
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {returnForm.agencia && (
                      <div className="selected-agency" style={{ marginTop: '15px', padding: '10px', background: 'white', borderRadius: '8px', borderLeft: '4px solid var(--starken-green)', fontSize: '0.85rem' }}>
                        📍 <strong>Seleccionado:</strong> {returnForm.agencia.AGENDESCRIPCION || `Agencia ${returnForm.agencia.AGENCODI}`}
                      </div>
                    )}
                  </div>
                )}

                <button className="submit-btn" type="submit" disabled={loading || !returnForm.motivo || !returnForm.familia || (returnForm.tipoLi === '1' && !returnForm.agencia)}>
                  {loading ? 'GUARDANDO...' : 'CONFIRMAR DEVOLUCIÓN'}
                </button>
              </motion.form>
            ) : (
              <motion.div key="ret2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="success-screen">
                <CheckCircle2 size={48} color="var(--starken-green)" />
                <h1>¡Devolución Registrada!</h1>
                <button className="submit-btn" onClick={handleReset}>NUEVA GESTIÓN</button>
              </motion.div>
            )
          ) : view === 'register' ? (
            /* --- REGISTRO --- */
            step === 0 ? (
              <motion.form key="reg0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleNext}>
                <div className="field-group"><label className="label">Ingresar OF para nueva gestión</label>
                  <input type="number" value={ofNumber} onChange={(e) => setOfNumber(e.target.value)} />
                </div>
                <button className="submit-btn" type="submit" disabled={loading}>{loading ? 'VALIDANDO...' : 'COMENZAR'}</button>
                {error && <p className="error-text">{error}</p>}
              </motion.form>
            ) : step === 1 ? (
              <motion.form key="reg1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={handleSubmit}>
                <div className="info-box">OF: {ofNumber}</div>
                <div className="field-group"><label className="label">¿Confirma intento de entrega?</label>
                  <div className="toggle-group">
                    <button type="button" className={`toggle-btn ${intento === 'si' ? 'active yes' : ''}`} onClick={() => setIntento('si')}>SÍ</button>
                    <button type="button" className={`toggle-btn ${intento === 'no' ? 'active no' : ''}`} onClick={() => setIntento('no')}>NO</button>
                  </div>
                </div>
                <div className="field-group"><label className="label">¿Confirma rechazo?</label>
                  <div className="toggle-group">
                    <button type="button" className={`toggle-btn ${rechazo === 'si' ? 'active yes' : ''}`} onClick={() => setRechazo('si')}>SÍ</button>
                    <button type="button" className={`toggle-btn ${rechazo === 'no' ? 'active no' : ''}`} onClick={() => setRechazo('no')}>NO</button>
                  </div>
                </div>
                <button className="submit-btn" type="submit" disabled={loading || !intento || !rechazo}>{loading ? 'GUARDANDO...' : 'CONFIRMAR'}</button>
              </motion.form>
            ) : step === 3 ? (
                <motion.div key="reg3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="result-container">
                  <div className="info-box" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span>OF: {ofNumber}</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '500', opacity: 0.7 }}>Destino Actual:</span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--starken-dark)', marginTop: '4px' }}>
                      <MapPin size={12}/> {direccionActual?.calle} {direccionActual?.numero}, {direccionActual?.comuna}, {direccionActual?.ciudad}, {direccionActual?.region}
                    </span>
                  </div>

                  <form onSubmit={handleSaveDir}>
                    <div className="field-group"><label className="label">¿La dirección es correcta?</label>
                      <div className="toggle-group">
                        <button type="button" className={`toggle-btn ${dirCorrecta === 'si' ? 'active yes' : ''}`} onClick={() => setDirCorrecta('si')}>SÍ</button>
                        <button type="button" className={`toggle-btn ${dirCorrecta === 'no' ? 'active no' : ''}`} onClick={() => setDirCorrecta('no')}>NO</button>
                      </div>
                    </div>

                    <AnimatePresence>
                      {dirCorrecta === 'no' && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                          <div className="field-group"><label className="label">Nueva Dirección (Calle)</label>
                            <input type="text" value={nuevaDireccion} onChange={(e) => setNuevaDireccion(e.target.value)} placeholder="Ej: Av. Principal" style={{width: '100%', padding: '16px', border: '1px solid #ddd', borderRadius: '12px', outline: 'none', transition: 'border 0.3s'}}/>
                          </div>
                          <div className="field-group"><label className="label">Nueva Numeración</label>
                            <input type="text" value={nuevaNumeracion} onChange={(e) => setNuevaNumeracion(e.target.value)} placeholder="Ej: 1234" style={{width: '100%', padding: '16px', border: '1px solid #ddd', borderRadius: '12px', outline: 'none', transition: 'border 0.3s'}}/>
                          </div>
                          <div className="field-group"><label className="label">Nueva Región</label>
                            <select value={nuevaRegion} onChange={(e) => { setNuevaRegion(e.target.value); setNuevaComuna(''); }} style={{width: '100%', padding: '16px', border: '1px solid #ddd', borderRadius: '12px', backgroundColor: '#fafafa', outline: 'none', transition: 'border 0.3s', marginBottom: '16px'}}>
                              <option value="">Todas las regiones...</option>
                              {regionesList.map(r => <option key={r.REGCODIGO} value={r.REGCODIGO}>{r.REGNOMBRE}</option>)}
                            </select>
                          </div>
                          <div className="field-group"><label className="label">Nueva Comuna</label>
                            <select value={nuevaComuna} onChange={(e) => setNuevaComuna(e.target.value)} style={{width: '100%', padding: '16px', border: '1px solid #ddd', borderRadius: '12px', backgroundColor: '#fafafa', outline: 'none', transition: 'border 0.3s'}}>
                              <option value="">Selecciona una comuna...</option>
                              {filteredComunas.map(c => <option key={c.COMUCODIGO} value={c.COMUCODIGO}>{c.COMUNOMBRE}</option>)}
                            </select>
                          </div>

                          {isGeocoding && <p style={{fontSize:'0.8rem', color:'var(--starken-orange)', fontWeight: '600', marginBottom: '10px'}}>Buscando coordenadas...</p>}
                          
                          {mapCoords && (
                            <div className="map-container" style={{ marginBottom: '20px', height: '200px' }}>
                              <MapContainer center={mapCoords} zoom={15} style={{ height: '100%', width: '100%', zIndex: 1 }}>
                                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                                <Marker position={mapCoords}>
                                  <Popup>Nueva ubicación detectada</Popup>
                                </Marker>
                              </MapContainer>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button className="submit-btn" type="submit" disabled={loading || !dirCorrecta || (dirCorrecta === 'no' && (!nuevaDireccion || !nuevaNumeracion || !nuevaComuna))}>
                      {loading ? 'GUARDANDO...' : 'CONFIRMAR DIRECCIÓN'}
                    </button>
                  </form>
                </motion.div>
            ) : (
              <motion.div key="reg2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="success-screen">
                <CheckCircle2 size={48} color="var(--starken-green)" />
                <h1>¡Guardado!</h1>
                <button className="submit-btn" onClick={handleReset}>NUEVA GESTIÓN</button>
              </motion.div>
            )
          ) : (
            /* --- CONSULTA --- */
            <motion.div key="lookup" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <form onSubmit={handleLookup}><div className="field-group">
                <label className="label">Buscar por OF</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" style={{ flex: 1 }} value={ofNumber} onChange={(e) => setOfNumber(e.target.value)} />
                  <button className="submit-btn" style={{ width: 'auto', marginTop: 0, padding: '0 20px' }} type="submit" disabled={loading}><Search size={20} /></button>
                </div>
              </div></form>

              {error && <p className="error-text">{error}</p>}

              {lookupResult && lookupResult.length > 0 && (
                <div className="result-container">
                  <div className="info-box" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span>OF: {ofNumber}</span>
                    {associatedMail && <span style={{ fontSize: '0.8rem', fontWeight: '500', opacity: 0.7 }}>Email: {associatedMail}</span>}
                  </div>

                  {/* Sub-pestañas de Consulta */}
                  <div className="sub-tab-container">
                    <button className={`sub-tab ${subView === 'devolucion' ? 'active dev' : ''}`} onClick={() => setSubView('devolucion')}>
                      <Undo2 size={14} /> DEVOLUCIÓN
                    </button>
                    <button className={`sub-tab ${subView === 'entrega' ? 'active ent' : ''}`} onClick={() => setSubView('entrega')}>
                      <PackageCheck size={14} /> ENTREGA
                    </button>
                  </div>

                  {subView === 'devolucion' && (
                    <>
                      {devGestion ? (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pda-card">
                          <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--starken-dark)' }}>Evidencia de Devolución</h4>
                          <div className="pda-meta">
                            <p style={{ color: 'var(--starken-green)', fontWeight: '800', textTransform: 'uppercase' }}>{devGestion.status}</p>
                            <p><Calendar size={14} /> {new Date(devGestion.fecha).toLocaleString()}</p>
                            <p><MapPin size={14} /> {devGestion.coordenadas}</p>
                          </div>
                          <div className="map-container">
                            <iframe width="100%" height="150" style={{ border: 0 }} loading="lazy" src={`https://maps.google.com/maps?q=${devGestion.coordenadas.replace(';', ',')}&t=&z=15&ie=UTF8&iwloc=&output=embed`}></iframe>
                          </div>
                          <div className="pda-gallery">
                            {devGestion.fotos.map((f, i) => (
                              <div key={i} className="pda-photo-container">
                                <a href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt={f.desc} className="pda-thumbnail" /></a>
                                <span className="pda-photo-desc">{f.desc}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ) : (
                        <div className="pda-card" style={{ textAlign: 'center', opacity: 0.6, padding: '40px 20px' }}>
                          <AlertCircle size={32} style={{ margin: '0 auto 12px' }} />
                          <p>No se encontró evidencia PDA de devolución para esta OF.</p>
                        </div>
                      )}

                      {/* Respuestas de la encuesta (Solo en Devolución) */}
                      {lookupResult && lookupResult.length > 0 && (
                        <>
                          <h3 className="label" style={{ marginTop: '24px', marginBottom: '12px' }}>Gestión Actual (Encuesta)</h3>
                          {lookupResult.map((res, i) => (
                            <div key={i} className="result-item">
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span className="label" style={{ fontSize: '0.75rem' }}>{res.DESCRIPCION}</span>
                                <span className={`badge ${res.VALOR === 'SI' ? 'yes' : 'no'}`}>{res.VALOR}</span>
                              </div>
                              <p style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <FileText size={12} /> Confirmado: {new Date(res.confirmacion).toLocaleString()}
                              </p>
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  )}

                  {subView === 'entrega' && (
                    <>
                      {entGestion ? (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pda-card">
                          <h4 style={{ margin: '0 0 12px', fontSize: '0.9rem', color: 'var(--starken-dark)' }}>Evidencia de Entrega</h4>
                          <div className="pda-meta">
                            <p style={{ color: 'var(--starken-green)', fontWeight: '800', textTransform: 'uppercase' }}>{entGestion.status}</p>
                            <p><Calendar size={14} /> {new Date(entGestion.fecha).toLocaleString()}</p>
                            <p><MapPin size={14} /> {entGestion.coordenadas}</p>
                          </div>
                          <div className="map-container">
                            <iframe width="100%" height="150" style={{ border: 0 }} loading="lazy" src={`https://maps.google.com/maps?q=${entGestion.coordenadas.replace(';', ',')}&t=&z=15&ie=UTF8&iwloc=&output=embed`}></iframe>
                          </div>
                          <div className="pda-gallery">
                            {entGestion.fotos.map((f, i) => (
                              <div key={i} className="pda-photo-container">
                                <a href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt={f.desc} className="pda-thumbnail" /></a>
                                <span className="pda-photo-desc">{f.desc}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ) : (
                        <div className="pda-card" style={{ textAlign: 'center', opacity: 0.6, padding: '40px 20px' }}>
                          <AlertCircle size={32} style={{ margin: '0 auto 12px' }} />
                          <p>No se encontró evidencia PDA de entrega para esta OF.</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default App;

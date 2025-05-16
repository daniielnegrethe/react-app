import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Configuración de Supabase - Reemplazar con sus credenciales
const supabaseUrl = 'https://zpzklpezeyhemgfgekea.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwemtscGV6ZXloZW1nZmdla2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2MTQzNzEsImV4cCI6MjA2MTE5MDM3MX0.-NC_MR14r7VMMR_sVhmGf5lyylbNug_OEk0--f8JNzQ';
const supabase = createClient(supabaseUrl, supabaseKey);

const ImageManager = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [filteredQuestions, setFilteredQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Cargar las preguntas que necesitan imágenes desde el archivo
  useEffect(() => {
    fetchQuestions();
  }, []);

  // Filtrar preguntas cuando cambia el término de búsqueda o categoría
  useEffect(() => {
    filterQuestions();
  }, [questions, searchTerm, categoryFilter]);

  // Obtener las preguntas que necesitan imágenes
  const fetchQuestions = async () => {
    setIsLoading(true);
    try {
      // Intentar cargar desde el archivo questions-needing-images.json si existe
      try {
        // Primero intentar leer el archivo directamente si está disponible en el frontend
        const questionsData = require('../questions-needing-images.json');
        setQuestions(questionsData);
        
        // Extraer categorías únicas
        const uniqueCategories = [...new Set(questionsData.map(q => q.category))];
        setCategories(uniqueCategories);
        setIsLoading(false);
        return;
      } catch (e) {
        // Si no se puede cargar localmente, intentar desde Supabase
        console.log("Archivo local no encontrado, buscando en Supabase...");
      }

      // Intentar cargar desde Supabase
      const { data: fileData, error: fileError } = await supabase.storage
        .from('assets')
        .download('questions-needing-images.json');
      
      if (!fileError && fileData) {
        // Si existe el archivo, usarlo
        const jsonData = await fileData.text();
        const parsedData = JSON.parse(jsonData);
        setQuestions(parsedData);
        
        // Extraer categorías únicas
        const uniqueCategories = [...new Set(parsedData.map(q => q.category))];
        setCategories(uniqueCategories);
      } else {
        // Si no existe el archivo, buscar preguntas sin imágenes en la base de datos
        const { data, error } = await supabase
          .from('questions')
          .select('id, text, category, topic_level, difficulty_level, images')
          .is('images', null)
          .order('category');
          
        if (error) throw error;
        
        setQuestions(data || []);
        
        // Extraer categorías únicas
        const uniqueCategories = [...new Set(data.map(q => q.category))];
        setCategories(uniqueCategories);
      }
    } catch (error) {
      console.error('Error al cargar preguntas:', error);
      setMessage({ 
        text: 'Error al cargar las preguntas. ' + error.message, 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar preguntas según criterios de búsqueda
  const filterQuestions = () => {
    let filtered = [...questions];
    
    // Filtrar por término de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(q => 
        q.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Filtrar por categoría
    if (categoryFilter) {
      filtered = filtered.filter(q => q.category === categoryFilter);
    }
    
    setFilteredQuestions(filtered);
  };

  // Manejar la selección de archivos
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setUploadedFiles(files);
  };

  // Subir imágenes a Supabase Storage
  const uploadImages = async () => {
    if (!selectedQuestion) {
      setMessage({ text: 'Por favor selecciona una pregunta primero', type: 'error' });
      return;
    }
    
    if (uploadedFiles.length === 0) {
      setMessage({ text: 'Por favor selecciona al menos un archivo', type: 'error' });
      return;
    }
    
    setIsLoading(true);
    setMessage({ text: '', type: '' });
    
    try {
      const imageRefs = [];
      
      // Subir cada archivo
      for (const file of uploadedFiles) {
        // Generar nombre de archivo único
        const fileExt = file.name.split('.').pop();
        const fileName = `${selectedQuestion.id}_${Date.now()}.${fileExt}`;
        
        // Subir archivo a Supabase Storage
        const { data, error } = await supabase.storage
          .from('question-images')
          .upload(fileName, file);
          
        if (error) throw error;
        
        imageRefs.push(fileName);
      }
      
      // Actualizar la pregunta con las referencias a las imágenes
      const { data: updateData, error: updateError } = await supabase
        .from('questions')
        .update({ images: imageRefs })
        .eq('id', selectedQuestion.id);
        
      if (updateError) throw updateError;
      
      // Actualizar la lista de preguntas
      await fetchQuestions();
      
      setMessage({ 
        text: `${imageRefs.length} imágenes subidas exitosamente para la pregunta ${selectedQuestion.id}`, 
        type: 'success' 
      });
      
      // Limpiar selección
      setUploadedFiles([]);
      document.getElementById('file-upload').value = '';
      
    } catch (error) {
      console.error('Error al subir imágenes:', error);
      setMessage({ 
        text: 'Error al subir imágenes. ' + error.message, 
        type: 'error' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Gestor de Imágenes para Preguntas</h1>
      
      {message.text && (
        <div className={`p-4 mb-6 rounded-md ${
          message.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
        }`}>
          {message.text}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Panel de filtros */}
        <div className="col-span-1 bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Filtros</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ID o texto de la pregunta"
              className="w-full p-2 border border-gray-300 rounded-md"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md"
            >
              <option value="">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-1">Total de preguntas: {questions.length}</p>
            <p className="text-sm text-gray-600">Preguntas filtradas: {filteredQuestions.length}</p>
          </div>
        </div>
        
        {/* Lista de preguntas */}
        <div className="col-span-2 bg-white p-4 rounded-lg shadow-md">
          <h2 className="text-lg font-semibold mb-4">Preguntas que necesitan imágenes</h2>
          
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredQuestions.length > 0 ? (
            <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-md">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Texto</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredQuestions.map((question) => (
                    <tr 
                      key={question.id} 
                      onClick={() => setSelectedQuestion(question)}
                      className={`hover:bg-blue-50 cursor-pointer ${
                        selectedQuestion?.id === question.id ? 'bg-blue-100' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                        {question.id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {question.category}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {question.text.length > 50 
                          ? question.text.substring(0, 50) + '...' 
                          : question.text
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 p-4">No se encontraron preguntas con los filtros actuales</p>
          )}
          
          {/* Panel de subida de imágenes */}
          <div className="mt-6">
            <h3 className="text-md font-semibold mb-4">Subir imágenes</h3>
            
            {selectedQuestion ? (
              <div className="bg-gray-50 p-4 rounded-md">
                <p className="text-sm mb-2">
                  <span className="font-medium">ID:</span> {selectedQuestion.id}
                </p>
                <p className="text-sm mb-2">
                  <span className="font-medium">Categoría:</span> {selectedQuestion.category}
                </p>
                <p className="text-sm mb-4">
                  <span className="font-medium">Texto:</span> {selectedQuestion.text}
                </p>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seleccionar imágenes
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileChange}
                    className="text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-medium
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                    "
                  />
                </div>
                
                <button
                  onClick={uploadImages}
                  disabled={isLoading || uploadedFiles.length === 0}
                  className={`py-2 px-4 rounded-md text-sm font-medium text-white ${
                    isLoading || uploadedFiles.length === 0
                      ? 'bg-blue-300 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isLoading ? 'Subiendo...' : 'Subir imágenes'}
                </button>
              </div>
            ) : (
              <p className="text-gray-500 p-4">Selecciona una pregunta para subir imágenes</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageManager;
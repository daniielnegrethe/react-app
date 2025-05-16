import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import EvaluationApp from './evaluationApp/EvaluationApp';
import ImageManager from './aplicación/ImageManager';

// Configuración de Supabase - Reemplazar con sus credenciales
const supabaseUrl = 'https://zpzklpezeyhemgfgekea.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwemtscGV6ZXloZW1nZmdla2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2MTQzNzEsImV4cCI6MjA2MTE5MDM3MX0.-NC_MR14r7VMMR_sVhmGf5lyylbNug_OEk0--f8JNzQ';

const supabase = createClient(supabaseUrl, supabaseKey);

const App = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Comprobar si es administrador (para demostración)
  useEffect(() => {
    // En una aplicación real, esta verificación sería parte de un sistema de autenticación
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true') {
      setIsAdmin(true);
    }
  }, []);
  
  // Componente de navegación
  const Navigation = () => {
    return (
      <nav className="bg-blue-600 text-white p-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between">
          <div className="flex items-center flex-shrink-0 mr-6">
            <span className="font-semibold text-xl tracking-tight cursor-pointer" onClick={() => setCurrentPage('home')}>
              PAMATEDU
            </span>
          </div>
          
          <div className="block lg:hidden">
            <button className="flex items-center px-3 py-2 border rounded text-blue-200 border-blue-400 hover:text-white hover:border-white">
              <svg className="fill-current h-3 w-3" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <title>Menú</title>
                <path d="M0 3h20v2H0V3zm0 6h20v2H0V9zm0 6h20v2H0v-2z"/>
              </svg>
            </button>
          </div>
          
          <div className="w-full block flex-grow lg:flex lg:items-center lg:w-auto">
            <div className="text-sm lg:flex-grow">
              <button 
                onClick={() => setCurrentPage('home')}
                className={`block mt-4 lg:inline-block lg:mt-0 hover:text-white mr-4 ${
                  currentPage === 'home' ? 'text-white font-medium' : 'text-blue-200'
                }`}
              >
                Inicio
              </button>
              <button 
                onClick={() => setCurrentPage('evaluation')}
                className={`block mt-4 lg:inline-block lg:mt-0 hover:text-white mr-4 ${
                  currentPage === 'evaluation' ? 'text-white font-medium' : 'text-blue-200'
                }`}
              >
                Evaluación
              </button>
              
              {isAdmin && (
                <>
                  <button 
                    onClick={() => setCurrentPage('images')}
                    className={`block mt-4 lg:inline-block lg:mt-0 hover:text-white mr-4 ${
                      currentPage === 'images' ? 'text-white font-medium' : 'text-blue-200'
                    }`}
                  >
                    Gestión de Imágenes
                  </button>
                  <button 
                    onClick={() => setCurrentPage('statistics')}
                    className={`block mt-4 lg:inline-block lg:mt-0 hover:text-white mr-4 ${
                      currentPage === 'statistics' ? 'text-white font-medium' : 'text-blue-200'
                    }`}
                  >
                    Estadísticas
                  </button>
                </>
              )}
            </div>
            
            {isAdmin && (
              <div>
                <span className="inline-block text-sm px-4 py-2 leading-none border rounded text-white border-white hover:border-transparent hover:text-blue-500 hover:bg-white mt-4 lg:mt-0">
                  Modo Administrador
                </span>
              </div>
            )}
          </div>
        </div>
      </nav>
    );
  };
  
  // Página de inicio
  const HomePage = () => {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Evaluación Adaptativa
          </h1>
          <p className="text-xl text-gray-600">
            Una experiencia de evaluación personalizada
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">¿Qué es la evaluación adaptativa?</h2>
            <p className="text-gray-600 mb-4">
              La evaluación adaptativa es un enfoque que personaliza las preguntas según el nivel de habilidad del estudiante.
              A diferencia de los exámenes tradicionales, este sistema selecciona inteligentemente las preguntas más 
              adecuadas para cada estudiante, proporcionando una medición más precisa del conocimiento.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Características</h2>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Base de datos con más de 260 preguntas de trigonometría
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Algoritmo adaptativo que ajusta la dificultad en tiempo real
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Estadísticas detalladas de desempeño por categoría
              </li>
              <li className="flex items-start">
                <svg className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Recomendaciones personalizadas basadas en resultados
              </li>
            </ul>
          </div>
        </div>
        
        <div className="text-center mb-12">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Temas evaluados</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-lg font-medium text-blue-600 mb-2">Ángulos</h3>
              <p className="text-gray-600 text-sm">39 preguntas</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-lg font-medium text-blue-600 mb-2">Funciones trigonométricas</h3>
              <p className="text-gray-600 text-sm">29 preguntas</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-lg font-medium text-blue-600 mb-2">Suma y resta</h3>
              <p className="text-gray-600 text-sm">53 preguntas</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-lg font-medium text-blue-600 mb-2">Identidades</h3>
              <p className="text-gray-600 text-sm">37 preguntas</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-lg font-medium text-blue-600 mb-2">Funciones de números reales</h3>
              <p className="text-gray-600 text-sm">44 preguntas</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-lg font-medium text-blue-600 mb-2">Gráficas</h3>
              <p className="text-gray-600 text-sm">36 preguntas</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-lg font-medium text-blue-600 mb-2">Ecuaciones</h3>
              <p className="text-gray-600 text-sm">30 preguntas</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-md">
              <h3 className="text-lg font-medium text-blue-600 mb-2">Total</h3>
              <p className="text-gray-600 text-sm">268 preguntas</p>
            </div>
          </div>
        </div>
        
        <div className="text-center">
          <button
            onClick={() => setCurrentPage('evaluation')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-colors text-lg"
          >
            Comenzar
          </button>
        </div>
      </div>
    );
  };
  
  // Página de estadísticas (para administradores)
  const StatisticsPage = () => {
    if (!isAdmin) {
      return (
        <div className="max-w-7xl mx-auto p-6">
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
            <p className="font-bold">Acceso restringido</p>
            <p>Necesitas permisos de administrador para ver esta página.</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="max-w-7xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Estadísticas del Sistema</h1>
        <p className="text-gray-600 mb-6">
          Esta sección está en desarrollo. Aquí se mostrarán estadísticas detalladas sobre el uso 
          del sistema, resultados por categoría, distribución de habilidades, etc.
        </p>
      </div>
    );
  };
  
  // Renderizar la página actual
  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'evaluation':
        return <EvaluationApp />;
      case 'images':
        return isAdmin ? <ImageManager /> : (
          <div className="max-w-7xl mx-auto p-6">
            <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4" role="alert">
              <p className="font-bold">Acceso restringido</p>
              <p>Necesitas permisos de administrador para ver esta página.</p>
            </div>
          </div>
        );
      case 'statistics':
        return <StatisticsPage />;
      default:
        return <HomePage />;
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100">
      <Navigation />
      {renderPage()}
      
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between">
            <div className="mb-6 md:mb-0">
              <h2 className="text-xl font-bold mb-2">PAMATEDU</h2>
              <p className="text-gray-400">Sistema de Evaluación Adaptativa de Trigonometría</p>
            </div>
            <div>
              <h3 className="text-lg font-medium mb-2">Contacto</h3>
              <p className="text-gray-400">daniielnegrethe24@gmail.com</p>
              <p className="text-gray-400">fer@gmail.com</p>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-700 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} PAMATEDU. Todos los derechos reservados.</p>
            <p> Plataforma realizada para fines educativos.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
// Limpieza del código y corrección del archivo

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

// Configuración de Supabase - Reemplazar con sus credenciales
const supabaseUrl = 'https://zpzklpezeyhemgfgekea.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwemtscGV6ZXloZW1nZmdla2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU2MTQzNzEsImV4cCI6MjA2MTE5MDM3MX0.-NC_MR14r7VMMR_sVhmGf5lyylbNug_OEk0--f8JNzQ';
const supabase = createClient(supabaseUrl, supabaseKey);

// Función para convertir habilidad a escala 1-28 (definida fuera del componente)
const convertToScaleOf28 = (rawAbility, navigationData) => {
  // Método 1: Basado en el historial de navegación
  if (navigationData && Array.isArray(navigationData) && navigationData.length > 0) {
    // Contar combinaciones únicas nivel-categoría visitadas con éxito
    const visitedCombinations = new Set();
    navigationData.forEach(step => {
      if (step.correct) {
        const key = `${step.prevLevel}-${step.prevCategory}`;
        visitedCombinations.add(key);
      }
    });
    
    // Contar y asegurar que el valor esté entre 1-28
    const count = Math.min(28, visitedCombinations.size);
    return Math.max(1, count); // Mínimo 1, máximo 28
  }
  
  // Método 2: Transformación de la escala numérica (fallback)
  // Convertir de escala -3 a +3 aproximadamente a escala 1-28
  const scaledValue = ((rawAbility + 3) / 6) * 27 + 1;
  return Math.max(1, Math.min(28, Math.round(scaledValue)));
};

// Función para actualizar la confianza de dominio usando la inferencia bayesiana (definida fuera del componente)
const updateConfidence = (currentConfidence, isCorrect) => {
  // Parámetros del modelo
  const pGuess = 0.25;        // Probabilidad de acertar por azar (4 opciones)
  const pMastery = 0.90;      // Probabilidad de acertar si domina el tema
  
  let newConfidence;
  
  if (isCorrect) {
    // Fórmula de Bayes para respuesta correcta
    newConfidence = (pMastery * currentConfidence) / 
                   (pMastery * currentConfidence + pGuess * (1 - currentConfidence));
  } else {
    // Fórmula de Bayes para respuesta incorrecta
    newConfidence = ((1 - pMastery) * currentConfidence) / 
                   ((1 - pMastery) * currentConfidence + (1 - pGuess) * (1 - currentConfidence));
  }
  
  // Limitar a rango 0-1
  return Math.max(0, Math.min(1, newConfidence));
};

// Componente para renderizar LaTeX de forma segura
const SafeLatex = ({ content }) => {
  if (!content) return <span>Sin texto</span>;
  
  // Limpiar y normalizar la entrada LaTeX
  const cleanedContent = String(content)
    .replace(/undefined/g, '')
    .replace(/\\\\/g, '\\') // Corregir doble escape de backslashes
    .replace(/\\?\\\(/g, '') // Eliminar \( o \\(
    .replace(/\\?\\\)/g, ''); // Eliminar \) o \\)
  
  // Verificar si necesita ser envuelto en delimitadores
  const needsWrap = !cleanedContent.trim().startsWith('$') && 
                   !cleanedContent.trim().startsWith('\\begin');
                   
  const processedContent = needsWrap ? `$${cleanedContent}$` : cleanedContent;
  
  try {
    return <Latex>{processedContent}</Latex>;
  } catch (error) {
    console.error("Error al renderizar LaTeX:", error);
    return <span>{content}</span>;
  }
};

// Componente principal
const EvaluationApp = () => {
  // Estados para controlar el flujo de la aplicación
  const [currentView, setCurrentView] = useState('login'); // login, evaluation, results
  
  // Estado para el estudiante
  const [sessionId, setSessionId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  
  // Estado para la evaluación
  const [currentAbility, setCurrentAbility] = useState(0);
  const [standardError, setStandardError] = useState(1);
  const [answeredQuestions, setAnsweredQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [currentCategory, setCurrentCategory] = useState('');
  
  // Estado para UI
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [results, setResults] = useState(null);
  
  // Configuración de depuración
  const [showDebug, setShowDebug] = useState(false);
  
  // Estados adicionales para el sistema adaptativo por niveles
  const [currentLevel, setCurrentLevel] = useState(1); // Nivel inicial: 1
  const [currentCategoryNumber, setCurrentCategoryNumber] = useState(1); // Categoría inicial: 1
  const [failedAttempts, setFailedAttempts] = useState(0); // Contador de intentos fallidos en el nivel actual
  const [levelHistory, setLevelHistory] = useState([]); // Historial de niveles visitados
  const [navigationSequence, setNavigationSequence] = useState([]); // Secuencia de navegación del estudiante
  const [evaluationEndReason, setEvaluationEndReason] = useState(''); // Razón por la que terminó la evaluación
  const [confidenceMatrix, setConfidenceMatrix] = useState(() => {
    // Inicializar matriz de confianza para cada combinación nivel-categoría
    const matrix = {};
    for (let level = 1; level <= 4; level++) {
      matrix[level] = {};
      for (let category = 1; category <= 7; category++) {
        matrix[level][category] = 0.5; // 50% de confianza inicial (neutral)
      }
    }
    return matrix;
  }); // Matriz de confianza estadística
  
  // Función para determinar si hay suficiente confianza para avanzar
  const hasSufficientConfidence = (level, category) => {
    const confidence = confidenceMatrix[level]?.[category] || 0;
    const CONFIDENCE_THRESHOLD = 0.7; // 70% de confianza para avanzar (ajustado desde 80%)
    
    console.log(`Confianza para Nivel ${level}, Categoría ${category}: ${(confidence * 100).toFixed(1)}%`);
    return confidence >= CONFIDENCE_THRESHOLD;
  };
  
  // Inicializar sesión
  useEffect(() => {
    if (!sessionId) {
      setSessionId(`session_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
      setStartTime(Date.now());
    }
  }, [sessionId]);
  
  // Función para obtener todas las preguntas disponibles
  const getAllQuestions = async () => {
    try {
      console.log("Obteniendo todas las preguntas de la base de datos");
      
      const { data, error } = await supabase
        .from('questions')
        .select('*');
      
      if (error) throw error;
      
      return data || [];
    } catch (error) {
      console.error("Error al obtener todas las preguntas:", error);
      return [];
    }
  };
  
  // Función para obtener preguntas por nivel y categoría (sistema adaptativo)
  const getQuestionsByLevelAndCategory = async (level, categoryNumber) => {
    try {
      console.log(`Buscando preguntas de nivel ${level}, categoría ${categoryNumber}`);
      
      // Consulta directa con ambos filtros usando 'difficulty_level' para la categoría
      const { data, error } = await supabase
        .from('questions')
        .select('*')
        .eq('topic_level', level)
        .eq('difficulty_level', categoryNumber)  // Filtrar directamente por difficulty_level
        .order('difficulty', { ascending: true });
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.log(`No se encontraron preguntas para nivel ${level}, categoría ${categoryNumber}`);
        return [];
      }
      
      // Filtrar preguntas ya respondidas
      const availableQuestions = data.filter(
        q => !answeredQuestions.includes(q.id)
      );
      
      console.log(`Encontradas ${data.length} preguntas para nivel ${level}, categoría ${categoryNumber}, 
                de las cuales ${availableQuestions.length} no han sido respondidas`);
      
      return availableQuestions;
    } catch (error) {
      console.error("Error al obtener preguntas por nivel y categoría:", error);
      return [];
    }
  };
  
  // Función para determinar si la evaluación debe detenerse
  const shouldStopEvaluation = () => {
    // Condición 1: Error estándar suficientemente bajo (precisión adecuada)
    // Cambiado de 0.3 a 0.2 para mayor precisión
    if (standardError < 0.2) {
      console.log("Finalizando evaluación: Precisión adecuada alcanzada (Error estándar < 0.2)");
      setEvaluationEndReason('precision');
      return true;
    }
    
    // Condición 2: Límite máximo de preguntas
    if (answeredQuestions.length >= 45) {
      console.log("Finalizando evaluación: Límite máximo de 45 preguntas alcanzado");
      setEvaluationEndReason('max_questions');
      return true;
    }
    
    return false;
  };
  
  // Función para seleccionar la siguiente pregunta adaptativa basada en niveles
  const selectNextQuestion = async () => {
    try {
      console.log("=== SISTEMA ADAPTATIVO ===");
      console.log(`Nivel actual: ${currentLevel}, Categoría: ${currentCategoryNumber}`);
      console.log(`Intentos fallidos: ${failedAttempts}`);
      
      // Verificar si debemos detener la evaluación según error estándar
      if (shouldStopEvaluation()) {
        console.log("Condición de parada cumplida");
        return null;
      }
      
      // Obtener preguntas para el nivel y categoría actuales
      let availableQuestions = await getQuestionsByLevelAndCategory(currentLevel, currentCategoryNumber);
      
      // Si no hay preguntas disponibles en esta categoría, intentar con la siguiente
      if (availableQuestions.length === 0) {
        console.log("No hay preguntas en esta categoría, buscando en la siguiente");
        
        // Buscar en las siguientes categorías del mismo nivel
        for (let cat = currentCategoryNumber + 1; cat <= 7; cat++) {
          availableQuestions = await getQuestionsByLevelAndCategory(currentLevel, cat);
          if (availableQuestions.length > 0) {
            console.log(`Encontradas preguntas en categoría ${cat}`);
            // Actualizar categoría actual
            setCurrentCategoryNumber(cat);
            break;
          }
        }
        
        // Si aún no hay preguntas, intentar con el siguiente nivel
        if (availableQuestions.length === 0 && currentLevel < 4) {
          console.log("No hay más preguntas en este nivel, pasando al siguiente nivel");
          
          // Buscar en el siguiente nivel, empezando por categoría 1
          availableQuestions = await getQuestionsByLevelAndCategory(currentLevel + 1, 1);
          if (availableQuestions.length > 0) {
            console.log(`Avanzando al nivel ${currentLevel + 1}, categoría 1`);
            setCurrentLevel(currentLevel + 1);
            setCurrentCategoryNumber(1);
            // Reiniciar contador de intentos fallidos al cambiar de nivel
            setFailedAttempts(0);
          }
        }
      }
      
      // Si todavía no hay preguntas disponibles, intentar con cualquier pregunta no respondida
      if (availableQuestions.length === 0) {
        console.log("No se encontraron preguntas específicas, buscando cualquier pregunta");
        const allQuestions = await getAllQuestions();
        availableQuestions = allQuestions.filter(q => !answeredQuestions.includes(q.id));
      }
      
      // Si hay preguntas disponibles, seleccionar una
      if (availableQuestions.length > 0) {
        // Ordenar por dificultad (si hay múltiples preguntas)
        availableQuestions.sort((a, b) => (a.difficulty || 0) - (b.difficulty || 0));
        
        // Seleccionar la primera pregunta (la de menor dificultad)
        return availableQuestions[0];
      }
      
      // Si no hay más preguntas disponibles
      console.log("No hay más preguntas disponibles");
      return null;
      
    } catch (error) {
      console.error("Error en selectNextQuestion:", error);
      return null;
    }
  };
  
  // Función auxiliar para procesar y establecer la pregunta
  const processAndSetQuestion = (question) => {
    // Limpiar el texto de la pregunta
    if (question.text) {
      question.text = question.text.replace(/^[A-Z]\r\s*/, '');
    }
    
    // Verificar formato de opciones y corregir si es necesario
    if (question.options && Array.isArray(question.options)) {
      // Filtrar opciones - eliminar las que no corresponden a esta pregunta
      const validOptions = [];
      for (let i = 0; i < question.options.length && validOptions.length < 4; i++) {
        const opt = question.options[i];
        if (opt && opt.text && opt.text.trim() !== '') {
          validOptions.push({
            text: opt.text,
            value: opt.value || String.fromCharCode(65 + validOptions.length) // A, B, C, D...
          });
        }
      }
      
      // Si no hay opciones válidas, crear algunas
      if (validOptions.length === 0) {
        for (let i = 0; i < 4; i++) {
          validOptions.push({
            text: `Opción ${String.fromCharCode(65 + i)}`,
            value: String.fromCharCode(65 + i)
          });
        }
      }
      
      // Asegurar que tenemos la opción correcta entre las opciones
      const correctValue = question.correct_option;
      let hasCorrectOption = validOptions.some(opt => opt.value === correctValue);
      
      if (!hasCorrectOption && correctValue && validOptions.length > 0) {
        // Si la opción correcta no está en las opciones, la añadimos al principio
        validOptions[0].value = correctValue;
      }
      
      question.options = validOptions;
    } else {
      console.warn("La pregunta no tiene opciones en formato array");
      // Crear opciones predeterminadas
      question.options = [
        {text: "Opción A", value: "A"},
        {text: "Opción B", value: "B"},
        {text: "Opción C", value: "C"},
        {text: "Opción D", value: "D"}
      ];
    }
    
    // Verificar correct_option
    if (!question.correct_option) {
      console.warn("La pregunta no tiene correct_option definido");
      question.correct_option = "A";
    }
    
    setCurrentQuestion(question);
    setQuestionStartTime(Date.now());
    
    // Actualizar categoría si cambia
    if (question.category !== currentCategory) {
      setCurrentCategory(question.category);
    }
  };
  
  // Función directa mejorada que usa selectNextQuestion
  const getDirectQuestion = async () => {
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      console.log("Ejecutando getDirectQuestion");
      
      // Intentar obtener todas las preguntas y filtrar manualmente
      const allQuestions = await getAllQuestions();
      
      if (!allQuestions || allQuestions.length === 0) {
        throw new Error("No hay preguntas en la base de datos");
      }
      
      // Elegir una al azar
      const randomIndex = Math.floor(Math.random() * allQuestions.length);
      const randomQuestion = allQuestions[randomIndex];
      
      console.log("Pregunta seleccionada aleatoriamente:", randomQuestion.id);
      
      // Procesar la pregunta
      processAndSetQuestion(randomQuestion);
      
    } catch (error) {
      console.error('Error en getDirectQuestion:', error);
      setErrorMessage('Error al cargar pregunta: ' + (error.message || 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Obtener siguiente pregunta con sistema adaptativo
  const getNextQuestion = async () => {
    setIsLoading(true);
    setErrorMessage('');
    setSelectedOption('');
    
    try {
      console.log("Iniciando getNextQuestion - respondidas:", answeredQuestions.length);
      console.log(`Nivel actual: ${currentLevel}, Categoría: ${currentCategoryNumber}, Intentos fallidos: ${failedAttempts}`);
      
      // Verificar si debemos finalizar la prueba
      if (shouldStopEvaluation()) {
        console.log("Finalizando prueba: condición de parada cumplida");
        setCurrentView('results');
        getResults();
        return;
      }
      
      // Usar la selección adaptativa por niveles
      const nextQuestion = await selectNextQuestion();
      
      if (nextQuestion) {
        processAndSetQuestion(nextQuestion);
      } else {
        // Si no hay más preguntas disponibles, finalizar la evaluación
        console.log("No hay más preguntas disponibles, finalizando evaluación");
        setErrorMessage('No hay más preguntas disponibles. La evaluación ha finalizado.');
        
        if (answeredQuestions.length > 0) {
          setCurrentView('results');
          getResults();
        }
      }
    } catch (error) {
      console.error('Error al obtener pregunta:', error);
      setErrorMessage('Error al cargar pregunta: ' + (error.message || 'Error desconocido'));
      
      // Intentar obtener cualquier pregunta como último recurso
      try {
        console.log("Último recurso - obteniendo una pregunta directa");
        const { data, error } = await supabase
          .from('questions')
          .select('*')
          .limit(1);
        
        if (!error && data && data.length > 0) {
          processAndSetQuestion(data[0]);
        } else {
          throw new Error("No se pudo obtener ninguna pregunta");
        }
      } catch (finalError) {
        console.error("Error final:", finalError);
        setErrorMessage('Error crítico: No se pudieron cargar preguntas.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Cálculo básico de actualización de habilidad
  const updateAbilityEstimate = (currentAbility, standardError, isCorrect, questionParams) => {
    // Obtener parámetros
    const a = questionParams.discrimination || 1;
    const b = questionParams.difficulty || 0;
    const c = questionParams.guessing || 0.25;
    
    let newAbility = currentAbility;
    let newError = standardError;
    
    // Método simplificado
    if (isCorrect) {
      // Si respuesta correcta, aumentar habilidad
      newAbility = currentAbility + (standardError * 0.5);
    } else {
      // Si respuesta incorrecta, disminuir habilidad
      newAbility = currentAbility - (standardError * 0.5);
    }
    
    // Reducir el error con cada respuesta
    newError = standardError * 0.9;
    
    console.log("Actualización de habilidad:", {
      prevAbility: currentAbility,
      newAbility,
      prevError: standardError,
      newError,
      isCorrect
    });
    
    return {
      ability: newAbility,
      error: newError
    };
  };
  
  // Función auxiliar para guardar respuesta en la BD
  const saveResponse = async (sessionId, studentId, questionId, selectedOption, isCorrect, 
                             responseTimeMs, newAbility, newError) => {
    try {
      // Registrar movimiento en la secuencia de navegación
      const movement = {
        timestamp: Date.now(),
        prevLevel: currentLevel,
        prevCategory: currentCategoryNumber,
        correct: isCorrect,
        question_id: questionId
      };
      
      // Determinar el tipo de movimiento para análisis
      let movementType = 'same';
      if (isCorrect) {
        if (currentCategoryNumber < 7) {
          movementType = 'category_up';
        } else if (currentLevel < 4) {
          movementType = 'level_up';
        }
      } else if (currentLevel > 1) {
        movementType = 'level_down';
      }
      
      // Actualizar secuencia de navegación
      const updatedSequence = [...navigationSequence, {
        ...movement,
        movementType
      }];
      setNavigationSequence(updatedSequence);
      
      // Convertir a escala de 28 niveles
      const scaledAbility = convertToScaleOf28(newAbility, updatedSequence);
      
      // Actualizar confianza en la matriz
      const currentConfidence = confidenceMatrix[currentLevel]?.[currentCategoryNumber] || 0.5;
      const newConfidence = updateConfidence(currentConfidence, isCorrect);
      
      // Actualizar matriz de confianza
      setConfidenceMatrix(prevMatrix => {
        const newMatrix = {...prevMatrix};
        if (!newMatrix[currentLevel]) {
          newMatrix[currentLevel] = {};
        }
        newMatrix[currentLevel][currentCategoryNumber] = newConfidence;
        return newMatrix;
      });
      
      // Guardar respuesta principal en la tabla responses
      const { error } = await supabase
        .from('responses')
        .insert([{
          session_id: sessionId,
          student_id: studentId || null,
          question_id: questionId,
          selected_option: selectedOption,
          correct: isCorrect,
          response_time_ms: responseTimeMs,
          estimated_ability: newAbility,
          standard_error: newError,
          // Datos adaptativos adicionales
          level: currentLevel,
          category: currentCategoryNumber,
          failed_attempts: failedAttempts,
          navigation_step: navigationSequence.length + 1,
          movement_type: movementType,
          scaled_ability: scaledAbility,
          confidence: newConfidence
        }]);
      
      if (error) {
        console.error("Error al guardar respuesta:", error);
        throw error;
      }
      
      // Guardar o actualizar matriz de habilidades por nivel-categoría
      try {
        // Verificar si ya existe un registro para esta combinación
        const { data: existingData, error: fetchError } = await supabase
          .from('ability_matrix')
          .select('*')
          .eq('session_id', sessionId)
          .eq('level', currentLevel)
          .eq('category', currentCategoryNumber)
          .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') {
          throw fetchError;
        }
        
        if (existingData) {
          // Actualizar registro existente
          await supabase
            .from('ability_matrix')
            .update({
              attempts: existingData.attempts + 1,
              correct: existingData.correct + (isCorrect ? 1 : 0),
              mastery: (existingData.correct + (isCorrect ? 1 : 0)) / (existingData.attempts + 1),
              last_ability: newAbility,
              scaled_ability: scaledAbility,
              confidence: newConfidence
            })
            .eq('id', existingData.id);
        } else {
          // Crear nuevo registro
          await supabase
            .from('ability_matrix')
            .insert([{
              session_id: sessionId,
              student_id: studentId,
              level: currentLevel,
              category: currentCategoryNumber,
              attempts: 1,
              correct: isCorrect ? 1 : 0,
              mastery: isCorrect ? 1 : 0,
              last_ability: newAbility,
              scaled_ability: scaledAbility,
              confidence: newConfidence,
              navigation_sequence: JSON.stringify(updatedSequence.slice(-5))
            }]);
        }
      } catch (matrixError) {
        // Solo registrar error, no interrumpir flujo principal
        console.error("Error al actualizar matriz de habilidades:", matrixError);
      }
      
      return true;
      
    } catch (error) {
      console.error("Error al guardar respuesta:", error);
      throw error;
    }
  };
  
  // Enviar respuesta con lógica adaptativa por niveles
  const submitAnswer = async () => {
    if (!selectedOption) {
      setErrorMessage('Por favor selecciona una respuesta');
      return;
    }
    
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const endTime = Date.now();
      const responseTimeMs = endTime - questionStartTime;
      
      const isCorrect = selectedOption === currentQuestion.correct_option;
      console.log("Respuesta:", { 
        seleccionada: selectedOption, 
        correcta: currentQuestion.correct_option, 
        esCorrecta: isCorrect 
      });
      
      // Parámetros de la pregunta
      const questionParams = {
        discrimination: currentQuestion.discrimination || 1,
        difficulty: currentQuestion.difficulty || 0,
        guessing: currentQuestion.guessing || 0.25
      };
      
      // Usar la función simplificada de actualización
      const { ability: newAbility, error: newError } = updateAbilityEstimate(
        currentAbility,
        standardError,
        isCorrect,
        questionParams
      );
      
      // LOGICA ADAPTATIVA: Actualizar nivel y categoría según la respuesta
      // Preparamos todas las actualizaciones de estado juntas para mayor eficiencia
      const updates = {
        failedAttempts: failedAttempts,
        levelHistory: [...levelHistory],
        currentLevel: currentLevel,
        currentCategoryNumber: currentCategoryNumber
      };
      
      if (isCorrect) {
        // Si responde correctamente
        // Añadir nivel actual al historial
        updates.levelHistory = [...levelHistory, { level: currentLevel, category: currentCategoryNumber }];
        
        // Reiniciar contador de intentos fallidos
        updates.failedAttempts = 0;
        
        // NUEVO: Verificar si hay suficiente confianza para avanzar
        const canAdvance = hasSufficientConfidence(currentLevel, currentCategoryNumber);
        
        if (canAdvance) {
          // Solo avanzar si hay suficiente confianza estadística
          console.log(`Confianza suficiente para avanzar desde Nivel ${currentLevel}, Categoría ${currentCategoryNumber}`);
          
          // LÓGICA MODIFICADA: Avanzar verticalmente por niveles (en lugar de horizontalmente por categorías)
          if (currentLevel < 4) {
            // Avanzar al siguiente nivel de la misma categoría
            updates.currentLevel = currentLevel + 1;
            console.log(`Avanzando a nivel ${currentLevel + 1}, manteniendo categoría ${currentCategoryNumber}`);
          } else {
            // Si estamos en el nivel más alto (4), avanzar a la siguiente categoría nivel 1
            if (currentCategoryNumber < 7) {
              updates.currentLevel = 1; 
              updates.currentCategoryNumber = currentCategoryNumber + 1;
              console.log(`Completados todos los niveles de categoría ${currentCategoryNumber}. Avanzando a categoría ${currentCategoryNumber + 1}, nivel 1`);
            } else {
              // Si ya estamos en la última categoría y último nivel, permanecemos ahí
              console.log(`Permaneciendo en nivel ${currentLevel}, categoría ${currentCategoryNumber} (máximo alcanzado)`);
            }
          }
        } else {
          console.log(`Respuesta correcta, pero confianza insuficiente para avanzar. Permaneciendo en Nivel ${currentLevel}, Categoría ${currentCategoryNumber}`);
          // Permanecer en el mismo nivel/categoría hasta tener suficiente confianza
        }
      } else {
        // Si responde incorrectamente
        // Incrementar contador de intentos fallidos
        updates.failedAttempts = failedAttempts + 1;
        
        // LÓGICA MODIFICADA: Retroceder un nivel dentro de la misma categoría
        if (currentLevel > 1) {
          // Si no está en nivel 1, retrocede un nivel en la misma categoría
          updates.currentLevel = currentLevel - 1;
          console.log(`Retrocediendo a nivel ${currentLevel - 1}, manteniendo categoría ${currentCategoryNumber}`);
        } else if (currentCategoryNumber > 1) {
          // Si está en nivel 1 de una categoría > 1, retrocede a nivel 4 de la categoría anterior
          updates.currentLevel = 4;
          updates.currentCategoryNumber = currentCategoryNumber - 1;
          console.log(`Retrocediendo a categoría ${currentCategoryNumber - 1}, nivel 4`);
        } else {
          // Si ya estamos en categoría 1, nivel 1, permanecemos ahí
          console.log(`Permaneciendo en nivel ${currentLevel}, categoría ${currentCategoryNumber} (mínimo alcanzado)`);
        }
      }
      
      // Guardar respuesta en la base de datos
      await saveResponse(sessionId, studentId, currentQuestion.id, selectedOption, isCorrect, 
                        responseTimeMs, newAbility, newError);
      
      // Actualizar estados con las actualizaciones preparadas
      setFailedAttempts(updates.failedAttempts);
      setLevelHistory(updates.levelHistory);
      setCurrentLevel(updates.currentLevel);
      setCurrentCategoryNumber(updates.currentCategoryNumber);
      
      // Actualizar habilidad y error estándar
      setCurrentAbility(newAbility);
      setStandardError(newError);
      setAnsweredQuestions([...answeredQuestions, currentQuestion.id]);
      
      // Verificar si debemos finalizar la evaluación
      if (shouldStopEvaluation()) {
        console.log("Condición de parada cumplida después de procesar respuesta");
        setCurrentView('results');
        getResults();
        return;
      }
      
      // Obtener siguiente pregunta
      getNextQuestion();
      
    } catch (error) {
      console.error('Error al enviar respuesta:', error);
      setErrorMessage('Error al enviar respuesta: ' + (error.message || 'Error desconocido'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Registrar estudiante
  const registerStudent = async () => {
    if (!studentCode || !studentName) {
      setErrorMessage('Código y nombre son requeridos');
      return;
    }
    
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      // Verificar si el estudiante ya existe
      const { data: existingStudent, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .eq('code', studentCode)
        .single();
      
      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }
      
      if (existingStudent) {
        setStudentId(existingStudent.id);
        setStudentName(existingStudent.name || '');
        setStudentGrade(existingStudent.grade || '');
        setCurrentView('evaluation');
        // Usar método directo para garantizar funcionamiento
        getDirectQuestion();
        return;
      }
      
      // Crear nuevo estudiante
      const { data: newStudent, error: insertError } = await supabase
        .from('students')
        .insert([
          { code: studentCode, name: studentName, grade: studentGrade }
        ])
        .select()
        .single();
      
      if (insertError) throw insertError;
      
      setStudentId(newStudent.id);
      setCurrentView('evaluation');
      // Usar método directo para garantizar funcionamiento
      getDirectQuestion();
    } catch (error) {
      console.error('Error al registrar estudiante:', error);
      setErrorMessage(error.message || 'Error al registrar. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Manejar selección de respuesta
  const handleOptionSelect = (option) => {
    setSelectedOption(option);
  };
  
  // Obtener resultados
  const getResults = async () => {
    setIsLoading(true);
    
    try {
      // Calcular el nivel de habilidad en escala 1-28
      const scaledAbility = convertToScaleOf28(currentAbility, navigationSequence);
      
      // Guardar información final de la evaluación
      try {
        const { error } = await supabase
          .from('evaluation_sessions')
          .insert([{
            session_id: sessionId,
            student_id: studentId,
            end_reason: evaluationEndReason,
            total_questions: answeredQuestions.length,
            final_ability: currentAbility,
            scaled_ability: scaledAbility,
            standard_error: standardError,
            total_time_ms: Date.now() - startTime,
            navigation_sequence: JSON.stringify(navigationSequence),
            max_level_reached: Math.max(...levelHistory.map(h => h.level), currentLevel),
            max_category_reached: levelHistory.length > 0 ? 
              Math.max(...levelHistory.filter(h => h.level === Math.max(...levelHistory.map(h => h.level)))
              .map(h => h.category), currentCategoryNumber) : currentCategoryNumber
          }]);
          
        if (error) {
          console.error("Error al guardar sesión de evaluación:", error);
        }
      } catch (sessionError) {
        console.error("Error al crear registro de sesión:", sessionError);
      }
      
      // Obtener estadísticas de la vista user_statistics
      const { data, error } = await supabase
        .from('user_statistics')
        .select('*')
        .eq('session_id', sessionId)
        .single();
      
      if (error) throw error;
      
      // Adaptar datos de habilidad a escala de 28 niveles
      if (data && data.final_ability !== undefined) {
        data.scaled_ability = scaledAbility;
      }
      
      // Obtener datos de la matriz de habilidades
      try {
        const { data: matrixData, error: matrixError } = await supabase
          .from('ability_matrix')
          .select('*')
          .eq('session_id', sessionId)
          .order('level', { ascending: true })
          .order('category', { ascending: true });
          
        if (!matrixError && matrixData) {
          // Añadir datos de matriz a los resultados
          data.ability_matrix = matrixData;
        }
      } catch (matrixError) {
        console.error('Error al obtener matriz de habilidades:', matrixError);
        // No interrumpir el flujo principal si falla
      }
      
      setResults(data);
    } catch (error) {
      console.error('Error al obtener resultados:', error);
      setErrorMessage('No se pudieron cargar los resultados finales');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Reiniciar evaluación
  const restartTest = () => {
    setSessionId(`session_${Date.now()}_${Math.floor(Math.random() * 1000)}`);
    setCurrentAbility(0);
    setStandardError(1);
    setAnsweredQuestions([]);
    setCurrentQuestion(null);
    setSelectedOption('');
    setStartTime(Date.now());
    setCurrentCategory('');
    // Reiniciar estados adaptativos
    setCurrentLevel(1);
    setCurrentCategoryNumber(1);
    setFailedAttempts(0);
    setLevelHistory([]);
    setNavigationSequence([]);
    setEvaluationEndReason('');
    // Cambiar vista
    setCurrentView('login');
    setResults(null);
  };
  
  // Renderizar imágenes si existen
  const renderImages = (images) => {
    if (!images || images.length === 0) return null;
    
    return (
      <div className="my-4 flex flex-wrap justify-center gap-4">
        {images.map((image, index) => (
          <img 
            key={index} 
            src={`${supabaseUrl}/storage/v1/object/public/question-images/${image}`} 
            alt={`Imagen ${index + 1}`} 
            className="max-w-full h-auto max-h-64 rounded-lg shadow-md" 
          />
        ))}
      </div>
    );
  };
  
  // Renderizar pantalla de inicio/registro
  if (currentView === 'login') {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md mx-auto bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
            Evaluación Adaptativa de Trigonometría
          </h1>
          
          {errorMessage && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
              <p>{errorMessage}</p>
            </div>
          )}
          
          <div>
            <div className="mb-4">
              <label htmlFor="studentCode" className="block text-gray-700 text-sm font-medium mb-2">
                Código o Matrícula*
              </label>
              <input
                type="text"
                id="studentCode"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="studentName" className="block text-gray-700 text-sm font-medium mb-2">
                Nombre Completo*
              </label>
              <input
                type="text"
                id="studentName"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="studentGrade" className="block text-gray-700 text-sm font-medium mb-2">
                Grado/Curso
              </label>
              <input
                type="text"
                id="studentGrade"
                value={studentGrade}
                onChange={(e) => setStudentGrade(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <button
              onClick={registerStudent}
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-blue-300"
            >
              {isLoading ? 'Cargando...' : 'Comenzar Evaluación'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Renderizar pantalla de resultados
  if (currentView === 'results' && results) {
    return (
      <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">
            Resultados de la Evaluación
          </h1>
          
          <div className="bg-blue-50 p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Resumen</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Estudiante:</p>
                <p className="font-medium">{studentName}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Código:</p>
                <p className="font-medium">{studentCode}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Nivel de Habilidad:</p>
                <p className="font-medium">
                  {results.scaled_ability ? 
                    `${results.scaled_ability} / 28` : 
                    results.final_ability ? 
                    `${convertToScaleOf28(results.final_ability, navigationSequence)} / 28` :
                    '-'}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Precisión de la Evaluación:</p>
                <p className="font-medium">
                  {results.final_error ? 
                    `${((1 - results.final_error) * 100).toFixed(1)}%` : 
                    '-'}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Preguntas Respondidas:</p>
                <p className="font-medium">{results.total_questions || '-'}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Precisión:</p>
                <p className="font-medium">{results.accuracy ? `${(results.accuracy * 100).toFixed(1)}%` : '-'}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Tiempo Promedio por Pregunta:</p>
                <p className="font-medium">{results.avg_time ? `${(results.avg_time / 1000).toFixed(1)} segundos` : '-'}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Tiempo Total:</p>
                <p className="font-medium">{results.total_time ? `${Math.floor(results.total_time / 60000)} minutos` : '-'}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-600">Evaluación finalizada por:</p>
                <p className="font-medium">
                  {evaluationEndReason === 'precision' ? 
                    'Precisión adecuada alcanzada' : 
                    evaluationEndReason === 'max_questions' ? 
                    'Límite máximo de preguntas' : 
                    'Finalización manual'}
                </p>
              </div>
              
              {showDebug && results.ability_matrix && (
                <div className="col-span-2 mt-2">
                  <p className="text-sm text-gray-600 mb-1">Matriz de Habilidades (Debug):</p>
                  <div className="bg-yellow-100 p-2 text-xs overflow-auto max-h-40">
                    <pre>{JSON.stringify(results.ability_matrix, null, 2)}</pre>
                  </div>
                </div>
              )}
              
              {showDebug && navigationSequence && navigationSequence.length > 0 && (
                <div className="col-span-2 mt-2">
                  <p className="text-sm text-gray-600 mb-1">Secuencia de Navegación (Debug):</p>
                  <div className="bg-yellow-100 p-2 text-xs overflow-auto max-h-40">
                    <pre>{JSON.stringify(navigationSequence, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {results.category_stats && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Resultados por Categoría</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoría</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preguntas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Correctas</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Precisión</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(results.category_stats).map(([category, stats]) => (
                      <tr key={category}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{category}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stats.count}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stats.correct}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {((stats.correct / stats.count) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          {/* Recomendaciones basadas en el nivel de habilidad */}
          <div className="mb-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Recomendaciones</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              {results.final_ability < -1.5 && (
                <>
                  <li>Revisar los conceptos básicos de medición de ángulos y círculo unitario</li>
                  <li>Practicar la conversión entre grados y radianes</li>
                  <li>Estudiar las definiciones básicas de las funciones trigonométricas</li>
                </>
              )}
              {results.final_ability >= -1.5 && results.final_ability < 0 && (
                <>
                  <li>Practicar la aplicación de identidades trigonométricas básicas</li>
                  <li>Repasar la suma y resta de funciones trigonométricas</li>
                  <li>Reforzar la comprensión de las gráficas de las funciones seno y coseno</li>
                </>
              )}
              {results.final_ability >= 0 && results.final_ability < 1.5 && (
                <>
                  <li>Profundizar en identidades trigonométricas compuestas</li>
                  <li>Practicar la resolución de ecuaciones trigonométricas simples</li>
                  <li>Analizar el comportamiento de las funciones trigonométricas de números reales</li>
                </>
              )}
              {results.final_ability >= 1.5 && (
                <>
                  <li>Explorar aplicaciones avanzadas de trigonometría</li>
                  <li>Resolver problemas complejos que combinen múltiples conceptos</li>
                  <li>Estudiar la relación entre la trigonometría y otros campos matemáticos</li>
                </>
              )}
            </ul>
          </div>
          
          <div className="flex justify-center">
            <button
              onClick={restartTest}
              className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Iniciar Nueva Evaluación
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Renderizar pantalla de evaluación (preguntas)
  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Evaluación Adaptativa
          </h1>
          
          <div className="text-sm text-gray-600">
            Pregunta {answeredQuestions.length + 1}
          </div>
        </div>
        
        {errorMessage && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
            <p>{errorMessage}</p>
          </div>
        )}
        
        {/* Panel de depuración con botón para mostrar/ocultar */}
        <div className="mb-4">
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
          >
            {showDebug ? "Ocultar Debug" : "Mostrar Debug"}
          </button>
          
          {showDebug && currentQuestion && (
            <div className="bg-yellow-100 p-2 mt-2 text-xs overflow-auto max-h-40">
              <p>Debug - Estado de la pregunta:</p>
              <pre>{JSON.stringify(currentQuestion, null, 2)}</pre>
              <p>Estado adaptativo:</p>
              <pre>{JSON.stringify({
                nivel: currentLevel,
                categoria: currentCategoryNumber,
                intentosFallidos: failedAttempts,
                preguntasRespondidas: answeredQuestions.length,
                errorEstandar: standardError.toFixed(4),
                habilidadActual: currentAbility.toFixed(4),
                habilidadEscala28: convertToScaleOf28(currentAbility, navigationSequence),
                confianza: confidenceMatrix[currentLevel]?.[currentCategoryNumber] 
                  ? (confidenceMatrix[currentLevel][currentCategoryNumber] * 100).toFixed(1) + '%' 
                  : 'N/A'
              }, null, 2)}</pre>
              <p>Secuencia de navegación:</p>
              <pre>{JSON.stringify(navigationSequence.slice(-3), null, 2)}</pre>
              <p>Matriz de confianza:</p>
              <pre>{JSON.stringify(confidenceMatrix, null, 2)}</pre>
            </div>
          )}
        </div>
        
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600"></div>
          </div>
        ) : currentQuestion ? (
          <div>
            <div className="bg-blue-50 p-4 rounded-lg mb-6">
              <p className="text-sm text-gray-600 mb-1">Categoría:</p>
              <p className="font-medium text-gray-800">{currentQuestion.category || 'Sin categoría'}</p>
            </div>

            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Pregunta:</h2>
              <div className="p-4 bg-gray-50 rounded-lg">
                {currentQuestion && currentQuestion.text ? (
                  <div className="question-text">
                    <SafeLatex content={String(currentQuestion.text)} />
                  </div>
                ) : (
                  <p>No hay texto de pregunta disponible</p>
                )}
                {currentQuestion && currentQuestion.images && renderImages(currentQuestion.images)}
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Selecciona una respuesta:</h3>
              
              <div className="space-y-3">
                {currentQuestion && currentQuestion.options && Array.isArray(currentQuestion.options) ? (
                  currentQuestion.options.map((option) => (
                    <div 
                      key={option.value || `option-${Math.random()}`}
                      onClick={() => handleOptionSelect(option.value)}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedOption === option.value 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-start">
                        <div className="mr-3 mt-0.5">
                          <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${
                            selectedOption === option.value
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-400'
                          }`}>
                            {selectedOption === option.value && (
                              <div className="h-2 w-2 rounded-full bg-white"></div>
                            )}
                          </div>
                        </div>
                        <div>
                          {option && option.text ? (
                            <SafeLatex content={option.text} />
                          ) : (
                            <span>Sin texto</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p>No hay opciones disponibles</p>
                )}
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={submitAnswer}
                disabled={!selectedOption || isLoading}
                className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:bg-blue-300"
              >
                {isLoading ? 'Enviando...' : 'Siguiente'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 mb-4">No hay preguntas disponibles.</p>
            <button
              onClick={getDirectQuestion} // Usar método directo cuando no hay preguntas
              className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Intentar nuevamente
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EvaluationApp;
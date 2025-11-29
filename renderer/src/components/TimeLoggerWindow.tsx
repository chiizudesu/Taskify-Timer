import React, { useEffect, useRef, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Flex,
  FormControl,
  FormLabel,
  Icon,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Text,
  Textarea,
  Tooltip,
  useDisclosure,
  VStack
} from '@chakra-ui/react';
import { BarChart, Pause, Play, Plus, Search, Settings as SettingsIcon, Square, Trash2 } from 'lucide-react';
import WorkShiftInfographic from './WorkShiftInfographic';
import SettingsModal from './SettingsModal';
import TitleBar from './TitleBar';
import { taskTimerService, Task, TimerState } from '../services/taskTimer';
import { settingsService } from '../services/settings';
import { useLayout } from '../contexts/LayoutContext';

const NON_BILLABLE_TASKS = [
  'Internal - Meetings',
  'Internal - IT Issues',
  'Internal - Workflow Planning'
];

const formatDurationInput = (value: string): string => {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}:${digits.slice(2)}`;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}:${digits.slice(4)}`;
};

const TimeLoggerWindow = () => {
  const { layout } = useLayout();
  const [timerState, setTimerState] = useState<TimerState>({ currentTask: null, isRunning: false, isPaused: false });
  const [taskName, setTaskName] = useState('New Task');
  const [currentTime, setCurrentTime] = useState(0);
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
  const [currentWindowTitle, setCurrentWindowTitle] = useState('');
  const [trackingEnabled, setTrackingEnabled] = useState(true);

  // Search
  const [taskSearchValue, setTaskSearchValue] = useState('');
  const [taskSearchResults, setTaskSearchResults] = useState<any[]>([]);
  const [isTaskSearchOpen, setIsTaskSearchOpen] = useState(false);
  const [isTaskSearchLoading, setIsTaskSearchLoading] = useState(false);
  const taskSearchInputRef = useRef<HTMLInputElement>(null);
  const taskSearchContainerRef = useRef<HTMLDivElement>(null);

  // Edit modal
  const editModal = useDisclosure();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingTaskName, setEditingTaskName] = useState('');
  const [editingTaskDuration, setEditingTaskDuration] = useState('');
  const [editingTaskNarration, setEditingTaskNarration] = useState('');
  const [presetTaskOptions, setPresetTaskOptions] = useState<string[]>([]);
  const [showPresetDropdown, setShowPresetDropdown] = useState(false);
  const editTaskInputRef = useRef<HTMLInputElement>(null);
  const editTaskDropdownRef = useRef<HTMLDivElement>(null);

  // Custom task modal
  const addCustomModal = useDisclosure();
  const [customTaskName, setCustomTaskName] = useState('');
  const [customTaskDuration, setCustomTaskDuration] = useState('');
  const [customTaskNarration, setCustomTaskNarration] = useState('');
  const [customTaskPresetOptions, setCustomTaskPresetOptions] = useState<string[]>([]);
  const [showCustomTaskPresetDropdown, setShowCustomTaskPresetDropdown] = useState(false);
  const customTaskInputRef = useRef<HTMLInputElement>(null);
  const customTaskDropdownRef = useRef<HTMLDivElement>(null);

  // Stop timer modal
  const stopTimerModal = useDisclosure();
  const [pendingTask, setPendingTask] = useState<Task | null>(null);
  const [stopTimerTaskName, setStopTimerTaskName] = useState('');
  const [stopTimerDuration, setStopTimerDuration] = useState('');
  const [stopTimerNarration, setStopTimerNarration] = useState('');
  const [stopTimerPresetOptions, setStopTimerPresetOptions] = useState<string[]>([]);
  const [showStopTimerPresetDropdown, setShowStopTimerPresetDropdown] = useState(false);
  const stopTimerInputRef = useRef<HTMLInputElement>(null);
  const stopTimerDropdownRef = useRef<HTMLDivElement>(null);

  const settingsModal = useDisclosure();

  // Load timer state
  useEffect(() => {
    const savedState = taskTimerService.getTimerState();
    if (savedState.currentTask && taskTimerService.isTaskFromDifferentDay(savedState.currentTask)) {
      if (savedState.isRunning) {
        const taskStartDate = new Date(savedState.currentTask.startTime);
        const taskDateGMT8 = new Date(taskStartDate.getTime() + 8 * 60 * 60 * 1000);
        const taskDateString = taskDateGMT8.toISOString().split('T')[0];
        const finalTask: Task = {
          ...savedState.currentTask,
          endTime: new Date(savedState.currentTask.startTime).toISOString(),
          duration: taskTimerService.calculateDuration(savedState.currentTask, false),
          isPaused: false
        };
        (window.electronAPI as any)?.saveTaskLog?.(taskDateString, finalTask).catch((error: any) => {
          console.error('[TaskTimer] Error auto-saving task from previous day:', error);
        });
      }
      const cleared = { currentTask: null, isRunning: false, isPaused: false };
      taskTimerService.saveTimerState(cleared);
      setTimerState(cleared);
      setTaskName('New Task');
      setCurrentTime(0);
      setPauseStartTime(null);
      return;
    }

    setTimerState(savedState);
    if (savedState.currentTask) {
      setTaskName(savedState.currentTask.name);
      const duration = taskTimerService.calculateDuration(savedState.currentTask, savedState.isPaused);
      setCurrentTime(duration);
    }
  }, []);

  // Timer tick
  useEffect(() => {
    if (!timerState.isRunning || timerState.isPaused || !timerState.currentTask) return;
    const interval = setInterval(() => {
      const duration = taskTimerService.calculateDuration(timerState.currentTask!, false);
      setCurrentTime(duration);
    }, 1000);
    return () => clearInterval(interval);
  }, [timerState.isRunning, timerState.isPaused, timerState.currentTask]);

  // Persist timer state
  useEffect(() => {
    if (timerState.currentTask) {
      taskTimerService.saveTimerState(timerState);
    }
  }, [timerState]);

  // Sync storage events
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'docuframe_timer_state' && e.newValue) {
        try {
          const newState: TimerState = JSON.parse(e.newValue);
          setTimerState(newState);
          if (newState.currentTask) {
            setTaskName(newState.currentTask.name);
            const duration = taskTimerService.calculateDuration(newState.currentTask, newState.isPaused);
            setCurrentTime(duration);
          } else {
            setTaskName('New Task');
            setCurrentTime(0);
          }
        } catch (error) {
          console.error('[FloatingTimer] Error parsing storage change:', error);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // File operation logging hook
  useEffect(() => {
    const handleFileOperation = (event: CustomEvent) => {
      const { operation, filePath } = event.detail;
      if (timerState.isRunning && timerState.currentTask) {
        const updatedTask = taskTimerService.logFileOperation(timerState.currentTask, operation, filePath);
        setTimerState(state => ({
          ...state,
          currentTask: updatedTask
        }));
      }
    };
    window.addEventListener('fileOperation', handleFileOperation as EventListener);
    return () => window.removeEventListener('fileOperation', handleFileOperation as EventListener);
  }, [timerState]);

  // Load tracking preference
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await settingsService.getSettings();
        setTrackingEnabled(settings.trackWindows !== false);
      } catch (error) {
        console.error('Failed to load tracking preference', error);
      }
    };
    loadSettings();
  }, [settingsModal.isOpen]);

  // Window tracking effect
  useEffect(() => {
    if (!trackingEnabled || !timerState.isRunning || timerState.isPaused || !timerState.currentTask) {
      return;
    }
    let disposed = false;
    const trackWindowTitle = async () => {
      try {
        const result = await (window.electronAPI as any)?.getActiveWindowTitle?.();
        if (!result?.success) return;
        const title = typeof result.title === 'string' ? result.title.trim() : '';
        if (!title) {
          setCurrentWindowTitle('(Time Logger)');
          return;
        }
        setCurrentWindowTitle(title);
        const currentState = taskTimerService.getTimerState();
        if (currentState.currentTask && currentState.isRunning && !currentState.isPaused) {
          const updatedTask = taskTimerService.logWindowTitle(currentState.currentTask, title);
          const newState = { ...currentState, currentTask: updatedTask };
          taskTimerService.saveTimerState(newState);
          if (!disposed) {
            setTimerState(newState);
          }
        }
      } catch (error) {
        console.error('[FloatingTimer] Error tracking window title:', error);
      }
    };

    trackWindowTitle();
    const interval = setInterval(trackWindowTitle, 2000);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [timerState.isRunning, timerState.isPaused, timerState.currentTask, trackingEnabled]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (taskSearchContainerRef.current && !taskSearchContainerRef.current.contains(event.target as Node)) {
        setIsTaskSearchOpen(false);
      }
    };
    if (isTaskSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isTaskSearchOpen]);

  // Task search
  const handleTaskSearch = async (value: string) => {
    setTaskSearchValue(value);
    if (!value.trim()) {
      setTaskSearchResults([]);
      return;
    }
    setIsTaskSearchLoading(true);
    try {
      const config = await (window.electronAPI as any)?.getConfig?.();
      const csvPath = config?.clientbasePath;
      const results: any[] = [];
      if (csvPath) {
        const rows = await (window.electronAPI as any)?.readCsv?.(csvPath);
        const clientNameFields = ['Client Name', 'ClientName', 'client name', 'client_name'];
        rows?.forEach((row: any) => {
          const field = clientNameFields.find(f => row[f] !== undefined);
          if (field && row[field]) {
            const valueLower = String(row[field]).toLowerCase();
            if (valueLower.includes(value.toLowerCase())) {
              results.push({ name: row[field], type: 'client' });
            }
          }
        });
      }
      NON_BILLABLE_TASKS.filter(task => task.toLowerCase().includes(value.toLowerCase())).forEach(task => {
        results.push({ name: task, type: 'internal' });
      });
      setTaskSearchResults(results.slice(0, 5));
    } catch (error) {
      console.error('Task search failed', error);
      setTaskSearchResults([]);
    }
    setIsTaskSearchLoading(false);
  };

  const handleTaskSelect = (name: string) => {
    setTaskName(name);
    setTaskSearchValue(name);
    setTaskSearchResults([]);
    setIsTaskSearchOpen(false);
    if (timerState.currentTask) {
      setTimerState({
        ...timerState,
        currentTask: { ...timerState.currentTask, name }
      });
    }
  };

  // Preset helpers
  const loadPresetTasks = async () => {
    try {
      const options: string[] = [...NON_BILLABLE_TASKS];
      const config = await (window.electronAPI as any)?.getConfig?.();
      const csvPath = config?.clientbasePath;
      if (csvPath) {
        const rows = await (window.electronAPI as any)?.readCsv?.(csvPath);
        const clientNameFields = ['Client Name', 'ClientName', 'client name', 'client_name'];
        rows?.forEach((row: any) => {
          const field = clientNameFields.find(f => row[f] !== undefined);
          if (field && row[field]) {
            options.push(String(row[field]));
          }
        });
      }
      setPresetTaskOptions([...new Set(options)].slice(0, 50));
    } catch (error) {
      console.error('Failed to load preset tasks', error);
      setPresetTaskOptions([...NON_BILLABLE_TASKS]);
    }
  };

  // Edit modal helpers
  const handleOpenEditModal = async (taskId: string) => {
    try {
      const today = taskTimerService.getTodayDateString();
      const result = await (window.electronAPI as any)?.getTaskLogs?.(today);
      if (result?.success && Array.isArray(result.tasks)) {
        const task = result.tasks.find((t: Task) => t.id === taskId);
        if (task) {
          setEditingTask(task);
          setEditingTaskName(task.name);
          setEditingTaskDuration(taskTimerService.formatDuration(task.duration));
          setEditingTaskNarration(task.narration || '');
          await loadPresetTasks();
          setShowPresetDropdown(false);
          editModal.onOpen();
        }
      }
    } catch (error) {
      console.error('Error loading task for edit:', error);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTask || !editingTaskName.trim() || !editingTaskDuration.trim()) return;
    const durationMatch = editingTaskDuration.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!durationMatch) {
      alert('Invalid duration format. Please use HH:MM or HH:MM:SS');
      return;
    }
    const hours = parseInt(durationMatch[1]);
    const minutes = parseInt(durationMatch[2]);
    const seconds = durationMatch[3] ? parseInt(durationMatch[3]) : 0;
    const newDuration = hours * 3600 + minutes * 60 + seconds;
    const updatedTask: Task = {
      ...editingTask,
      name: editingTaskName.trim(),
      duration: newDuration,
      endTime: new Date(new Date(editingTask.startTime).getTime() + newDuration * 1000).toISOString()
    };
    try {
      const today = taskTimerService.getTodayDateString();
      const result = await (window.electronAPI as any)?.saveTaskLog?.(today, updatedTask);
      if (result?.success) {
        editModal.onClose();
        setEditingTask(null);
        window.dispatchEvent(new Event('task-updated'));
      } else {
        alert('Failed to save task changes');
      }
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Error saving task changes');
    }
  };

  const handleDeleteTask = async () => {
    if (!editingTask) return;
    if (!confirm(`Are you sure you want to delete the task "${editingTask.name}"?`)) return;
    try {
      const today = taskTimerService.getTodayDateString();
      const result = await (window.electronAPI as any)?.deleteTaskLog?.(today, editingTask.id);
      if (result?.success) {
        editModal.onClose();
        setEditingTask(null);
        window.dispatchEvent(new Event('task-updated'));
      } else {
        alert('Failed to delete task');
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Error deleting task');
    }
  };

  // Add custom task modal
  const loadCustomTaskPresetTasks = async () => {
    try {
      const options: string[] = [...NON_BILLABLE_TASKS];
      const config = await (window.electronAPI as any)?.getConfig?.();
      const csvPath = config?.clientbasePath;
      if (csvPath) {
        const rows = await (window.electronAPI as any)?.readCsv?.(csvPath);
        const clientNameFields = ['Client Name', 'Client', 'Name', 'Company'];
        rows?.forEach((row: any) => {
          const field = clientNameFields.find(f => row[f] && row[f].trim());
          if (field) {
            options.push(String(row[field]).trim());
          }
        });
      }
      setCustomTaskPresetOptions([...new Set(options)].slice(0, 50));
    } catch (error) {
      console.error('Error loading preset tasks:', error);
      setCustomTaskPresetOptions([...NON_BILLABLE_TASKS]);
    }
  };

  const handleSaveCustomTask = async () => {
    if (!customTaskName.trim() || !customTaskDuration.trim()) return;
    const match = customTaskDuration.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) {
      alert('Invalid duration format. Please use HH:MM or HH:MM:SS');
      return;
    }
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = match[3] ? parseInt(match[3]) : 0;
    const duration = hours * 3600 + minutes * 60 + seconds;
    try {
      const today = taskTimerService.getTodayDateString();
      const now = new Date();
      const newTask: Task = {
        id: `custom-${Date.now()}`,
        name: customTaskName.trim(),
        startTime: new Date(now.getTime() - duration * 1000).toISOString(),
        endTime: now.toISOString(),
        duration,
        isPaused: false,
        fileOperations: [],
        windowTitles: [],
        pausedDuration: 0,
        narration: customTaskNarration.trim() || undefined
      };
      const result = await (window.electronAPI as any)?.saveTaskLog?.(today, newTask);
      if (result?.success) {
        addCustomModal.onClose();
        setCustomTaskName('');
        setCustomTaskDuration('');
        setCustomTaskNarration('');
        window.dispatchEvent(new Event('task-updated'));
      } else {
        alert('Failed to save custom task');
      }
    } catch (error) {
      console.error('Error saving custom task:', error);
      alert('Error saving custom task');
    }
  };

  // Stop timer modal helpers
  const loadStopTimerPresetTasks = loadCustomTaskPresetTasks;

  const handleStopTimer = async () => {
    if (!timerState.currentTask) return;
    const calculatedDuration = taskTimerService.calculateDuration(timerState.currentTask, false);
    const finalTask: Task = {
      ...timerState.currentTask,
      endTime: new Date().toISOString(),
      duration: calculatedDuration,
      pausedDuration: timerState.currentTask.pausedDuration + (timerState.isPaused && pauseStartTime ? Math.floor((Date.now() - pauseStartTime) / 1000) : 0),
      isPaused: false
    };
    setPendingTask(finalTask);
    setStopTimerTaskName(finalTask.name);
    setStopTimerDuration(taskTimerService.formatDuration(calculatedDuration));
    setStopTimerNarration(finalTask.narration || '');
    await loadStopTimerPresetTasks();
    stopTimerModal.onOpen();
  };

  const handleConfirmStopTimer = async () => {
    if (!pendingTask || !stopTimerTaskName.trim() || !stopTimerDuration.trim()) return;
    const match = stopTimerDuration.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) {
      alert('Invalid duration format. Please use HH:MM or HH:MM:SS');
      return;
    }
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = match[3] ? parseInt(match[3]) : 0;
    const duration = hours * 3600 + minutes * 60 + seconds;
    const finalTask: Task = {
      ...pendingTask,
      name: stopTimerTaskName.trim(),
      duration,
      narration: stopTimerNarration.trim() || undefined
    };
    try {
      const today = taskTimerService.getTodayDateString();
      const result = await (window.electronAPI as any)?.saveTaskLog?.(today, finalTask);
      if (result?.success) {
        setTimerState({ currentTask: null, isRunning: false, isPaused: false });
        setCurrentTime(0);
        setPauseStartTime(null);
        setTaskName('New Task');
        taskTimerService.saveTimerState({ currentTask: null, isRunning: false, isPaused: false });
        stopTimerModal.onClose();
        setPendingTask(null);
        setStopTimerTaskName('');
        setStopTimerDuration('');
        setStopTimerNarration('');
        window.dispatchEvent(new Event('task-updated'));
      } else {
        alert('Failed to save task');
      }
    } catch (error) {
      console.error('Error saving task log:', error);
      alert('Error saving task log');
    }
  };

  // Timer controls
  const handleStartTimer = () => {
    if (timerState.isRunning && timerState.isPaused && timerState.currentTask) {
      const pauseDuration = pauseStartTime ? Math.floor((Date.now() - pauseStartTime) / 1000) : 0;
      const updatedTask = {
        ...timerState.currentTask,
        pausedDuration: timerState.currentTask.pausedDuration + pauseDuration,
        isPaused: false
      };
      setTimerState({ currentTask: updatedTask, isRunning: true, isPaused: false });
      setPauseStartTime(null);
    } else if (!timerState.isRunning) {
      const newTask = taskTimerService.startTask(taskName || 'New Task');
      setTimerState({ currentTask: newTask, isRunning: true, isPaused: false });
      setCurrentTime(0);
    }
  };

  const handlePauseTimer = () => {
    if (timerState.isRunning && !timerState.isPaused) {
      setPauseStartTime(Date.now());
      setTimerState(state => ({ ...state, isPaused: true }));
    }
  };

  const handleOpenAddCustomTaskModal = async () => {
    await loadCustomTaskPresetTasks();
    addCustomModal.onOpen();
  };

  const minutes = Math.floor(currentTime / 60);
  const seconds = currentTime % 60;
  const progressPercent = ((currentTime % 3600) / 3600) * 100;
  const currentHour = Math.floor(currentTime / 3600);
  const isOddHour = currentHour % 2 === 1;
  const timerColor = isOddHour ? 'purple.400' : 'cyan.400';

  return (
    <>
      <SettingsModal
        isOpen={settingsModal.isOpen}
        onClose={settingsModal.onClose}
        onSaved={() => window.dispatchEvent(new Event('task-updated'))}
      />

      <Box w="100%" h="100%" bg="gray.900" color="white" display="flex" flexDirection="column">
        <TitleBar />
        
        {layout === 'horizontal' ? (
          <Flex flex={1} h="calc(100% - 32px)" bg="gray.900">
            {/* Left Sidebar - Control Buttons */}
            <Flex 
              direction="column" 
              w="48px" 
              bg="gray.800" 
              borderRight="1px solid" 
              borderColor="whiteAlpha.100"
              align="center"
              py={2}
              gap={2}
            >
              <Tooltip label="Start" placement="right">
                <IconButton
                  aria-label="Start timer"
                  icon={<Play size={16} />}
                  onClick={handleStartTimer}
                  isDisabled={timerState.isRunning && !timerState.isPaused}
                  colorScheme="green"
                  variant="outline"
                  borderColor="green.400"
                  size="sm"
                  w="36px"
                  h="36px"
                  borderRadius="sm"
                />
              </Tooltip>
              <Tooltip label="Pause" placement="right">
                <IconButton
                  aria-label="Pause timer"
                  icon={<Pause size={16} />}
                  onClick={handlePauseTimer}
                  isDisabled={!timerState.isRunning || timerState.isPaused}
                  colorScheme="yellow"
                  variant="outline"
                  borderColor="yellow.400"
                  size="sm"
                  w="36px"
                  h="36px"
                  borderRadius="sm"
                />
              </Tooltip>
              <Tooltip label="Stop" placement="right">
                <IconButton
                  aria-label="Stop timer"
                  icon={<Square size={16} />}
                  onClick={handleStopTimer}
                  isDisabled={!timerState.isRunning}
                  colorScheme="red"
                  variant="outline"
                  borderColor="red.400"
                  size="sm"
                  w="36px"
                  h="36px"
                  borderRadius="sm"
                />
              </Tooltip>
              <Tooltip label="Settings" placement="right">
                <IconButton
                  aria-label="Open settings"
                  icon={<SettingsIcon size={16} />}
                  onClick={settingsModal.onOpen}
                  variant="outline"
                  borderColor="gray.500"
                  colorScheme="gray"
                  size="sm"
                  w="36px"
                  h="36px"
                  borderRadius="sm"
                  mt="auto"
                />
              </Tooltip>
            </Flex>

            {/* Center Area - Timer Display */}
            <Flex flex={1} direction="column" bg="gray.900" p={4}>
              {/* Search Bar */}
              <Box ref={taskSearchContainerRef} position="relative" mb={4}>
                <InputGroup>
                  <Input
                    ref={taskSearchInputRef}
                    value={timerState.isRunning ? taskName : taskSearchValue}
                    onChange={(e) => {
                      if (!timerState.isRunning) {
                        const value = e.target.value;
                        setTaskSearchValue(value);
                        setTaskName(value);
                        setIsTaskSearchOpen(true);
                        handleTaskSearch(value);
                      }
                    }}
                    onFocus={() => {
                      if (!timerState.isRunning) {
                        setIsTaskSearchOpen(true);
                        if (taskSearchValue) {
                          handleTaskSearch(taskSearchValue);
                        }
                      }
                    }}
                    placeholder="Search task or client..."
                    fontSize="sm"
                    bg="whiteAlpha.100"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    color="white"
                    pl={9}
                    disabled={timerState.isRunning}
                    h="32px"
                  />
                  <InputLeftElement pointerEvents="none" pl={3} h="32px">
                    <Icon as={Search} boxSize={4} color="gray.400" />
                  </InputLeftElement>
                  <InputRightElement pr={3} h="32px">
                    {isTaskSearchLoading && <Spinner size="xs" color="blue.400" />}
                  </InputRightElement>
                </InputGroup>

                {isTaskSearchOpen && !timerState.isRunning && (isTaskSearchLoading || taskSearchResults.length > 0 || taskSearchValue) && (
                  <Box
                    position="absolute"
                    mt={1}
                    bg="gray.800"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    borderRadius="md"
                    boxShadow="0 4px 12px rgba(0,0,0,0.4)"
                    maxH="200px"
                    overflowY="auto"
                    zIndex={10}
                    w="100%"
                  >
                    {isTaskSearchLoading ? (
                      <Flex justify="center" align="center" py={4}>
                        <Text color="gray.500" fontSize="sm">
                          Searching...
                        </Text>
                      </Flex>
                    ) : taskSearchResults.length > 0 ? (
                      <VStack spacing={0} align="stretch" p={1}>
                        {taskSearchResults.map((result, idx) => (
                          <Box
                            key={`${result.name}-${idx}`}
                            px={3}
                            py={2}
                            cursor="pointer"
                            _hover={{ bg: 'whiteAlpha.100' }}
                            onClick={() => handleTaskSelect(result.name)}
                            borderBottom={idx < taskSearchResults.length - 1 ? '1px solid' : 'none'}
                            borderColor="whiteAlpha.100"
                          >
                            <Flex align="center" gap={2}>
                              <Text fontSize="12px" fontWeight="500" color="white">
                                {result.name}
                              </Text>
                              {result.type === 'internal' && (
                                <Badge colorScheme="orange" fontSize="9px" px={1.5} py={0}>
                                  Internal
                                </Badge>
                              )}
                            </Flex>
                          </Box>
                        ))}
                      </VStack>
                    ) : taskSearchValue ? (
                      <Box textAlign="center" py={4}>
                        <Text color="gray.500" fontSize="sm">
                          No results found
                        </Text>
                      </Box>
                    ) : null}
                  </Box>
                )}
              </Box>

              {/* Timer Display */}
              <Flex flex={1} direction="column" justify="center" align="center" gap={3}>
                <Text fontSize="6xl" fontWeight="700" fontFamily="Helvetica, Arial, sans-serif" color="white" letterSpacing="0.05em" textAlign="center">
                  {taskTimerService.formatDuration(currentTime)}
                </Text>
                
                {/* Progress Bar */}
                <Box w="100%" maxW="600px" h="8px" bg="whiteAlpha.200" borderRadius="full" overflow="hidden">
                  <Box
                    h="100%"
                    w={`${progressPercent}%`}
                    bg={timerState.isRunning ? (timerState.isPaused ? 'yellow.400' : timerColor) : 'gray.500'}
                    borderRadius="full"
                    transition="width 0.3s ease"
                  />
                </Box>

                {/* Task Identifier */}
                {taskName && (
                  <Flex align="center" gap={2}>
                    <Text fontSize="sm" color="gray.400">
                      ({taskName})
                    </Text>
                    {timerState.currentTask?.id && (
                      <Badge bg="purple.500" color="white" fontSize="xs" px={2} py={0.5} borderRadius="sm">
                        {timerState.currentTask.id.slice(-3)}
                      </Badge>
                    )}
                  </Flex>
                )}
              </Flex>
            </Flex>

            {/* Right Panel - Summary */}
            <WorkShiftInfographic onEditTask={handleOpenEditModal} onAddCustomTask={handleOpenAddCustomTaskModal} />
          </Flex>
        ) : (
          <Flex flex={1} h="calc(100% - 32px)" bg="gray.900" direction="column">
            {/* Center Area - Timer Display */}
            <Flex flex={1} direction="column" bg="gray.900" p={4}>
              {/* Search Bar */}
              <Box ref={taskSearchContainerRef} position="relative" mb={4}>
                <InputGroup>
                  <Input
                    ref={taskSearchInputRef}
                    value={timerState.isRunning ? taskName : taskSearchValue}
                    onChange={(e) => {
                      if (!timerState.isRunning) {
                        const value = e.target.value;
                        setTaskSearchValue(value);
                        setTaskName(value);
                        setIsTaskSearchOpen(true);
                        handleTaskSearch(value);
                      }
                    }}
                    onFocus={() => {
                      if (!timerState.isRunning) {
                        setIsTaskSearchOpen(true);
                        if (taskSearchValue) {
                          handleTaskSearch(taskSearchValue);
                        }
                      }
                    }}
                    placeholder="Search task or client..."
                    fontSize="sm"
                    bg="whiteAlpha.100"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    color="white"
                    pl={9}
                    disabled={timerState.isRunning}
                    h="32px"
                  />
                  <InputLeftElement pointerEvents="none" pl={3} h="32px">
                    <Icon as={Search} boxSize={4} color="gray.400" />
                  </InputLeftElement>
                  <InputRightElement pr={3} h="32px">
                    {isTaskSearchLoading && <Spinner size="xs" color="blue.400" />}
                  </InputRightElement>
                </InputGroup>

                {isTaskSearchOpen && !timerState.isRunning && (isTaskSearchLoading || taskSearchResults.length > 0 || taskSearchValue) && (
                  <Box
                    position="absolute"
                    mt={1}
                    bg="gray.800"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    borderRadius="md"
                    boxShadow="0 4px 12px rgba(0,0,0,0.4)"
                    maxH="200px"
                    overflowY="auto"
                    zIndex={10}
                    w="100%"
                  >
                    {isTaskSearchLoading ? (
                      <Flex justify="center" align="center" py={4}>
                        <Text color="gray.500" fontSize="sm">
                          Searching...
                        </Text>
                      </Flex>
                    ) : taskSearchResults.length > 0 ? (
                      <VStack spacing={0} align="stretch" p={1}>
                        {taskSearchResults.map((result, idx) => (
                          <Box
                            key={`${result.name}-${idx}`}
                            px={3}
                            py={2}
                            cursor="pointer"
                            _hover={{ bg: 'whiteAlpha.100' }}
                            onClick={() => handleTaskSelect(result.name)}
                            borderBottom={idx < taskSearchResults.length - 1 ? '1px solid' : 'none'}
                            borderColor="whiteAlpha.100"
                          >
                            <Flex align="center" gap={2}>
                              <Text fontSize="12px" fontWeight="500" color="white">
                                {result.name}
                              </Text>
                              {result.type === 'internal' && (
                                <Badge colorScheme="orange" fontSize="9px" px={1.5} py={0}>
                                  Internal
                                </Badge>
                              )}
                            </Flex>
                          </Box>
                        ))}
                      </VStack>
                    ) : taskSearchValue ? (
                      <Box textAlign="center" py={4}>
                        <Text color="gray.500" fontSize="sm">
                          No results found
                        </Text>
                      </Box>
                    ) : null}
                  </Box>
                )}
              </Box>

              {/* Timer Display */}
              <Flex flex={1} direction="column" justify="center" align="center" gap={3}>
                <Text fontSize="6xl" fontWeight="700" fontFamily="Helvetica, Arial, sans-serif" color="white" letterSpacing="0.05em" textAlign="center">
                  {taskTimerService.formatDuration(currentTime)}
                </Text>
                
                {/* Progress Bar */}
                <Box w="100%" maxW="600px" h="8px" bg="whiteAlpha.200" borderRadius="full" overflow="hidden">
                  <Box
                    h="100%"
                    w={`${progressPercent}%`}
                    bg={timerState.isRunning ? (timerState.isPaused ? 'yellow.400' : timerColor) : 'gray.500'}
                    borderRadius="full"
                    transition="width 0.3s ease"
                  />
                </Box>

                {/* Task Identifier */}
                {taskName && (
                  <Flex align="center" gap={2}>
                    <Text fontSize="sm" color="gray.400">
                      ({taskName})
                    </Text>
                    {timerState.currentTask?.id && (
                      <Badge bg="purple.500" color="white" fontSize="xs" px={2} py={0.5} borderRadius="sm">
                        {timerState.currentTask.id.slice(-3)}
                      </Badge>
                    )}
                  </Flex>
                )}
              </Flex>
            </Flex>

            {/* Bottom Control Buttons - Horizontal Bar */}
            <Flex 
              direction="row" 
              h="48px" 
              bg="gray.800" 
              borderTop="1px solid" 
              borderColor="whiteAlpha.100"
              align="center"
              justify="center"
              px={2}
              gap={2}
            >
              <Tooltip label="Start" placement="top">
                <IconButton
                  aria-label="Start timer"
                  icon={<Play size={16} />}
                  onClick={handleStartTimer}
                  isDisabled={timerState.isRunning && !timerState.isPaused}
                  colorScheme="green"
                  variant="outline"
                  borderColor="green.400"
                  size="sm"
                  w="36px"
                  h="36px"
                  borderRadius="sm"
                />
              </Tooltip>
              <Tooltip label="Pause" placement="top">
                <IconButton
                  aria-label="Pause timer"
                  icon={<Pause size={16} />}
                  onClick={handlePauseTimer}
                  isDisabled={!timerState.isRunning || timerState.isPaused}
                  colorScheme="yellow"
                  variant="outline"
                  borderColor="yellow.400"
                  size="sm"
                  w="36px"
                  h="36px"
                  borderRadius="sm"
                />
              </Tooltip>
              <Tooltip label="Stop" placement="top">
                <IconButton
                  aria-label="Stop timer"
                  icon={<Square size={16} />}
                  onClick={handleStopTimer}
                  isDisabled={!timerState.isRunning}
                  colorScheme="red"
                  variant="outline"
                  borderColor="red.400"
                  size="sm"
                  w="36px"
                  h="36px"
                  borderRadius="sm"
                />
              </Tooltip>
              <Tooltip label="Settings" placement="top">
                <IconButton
                  aria-label="Open settings"
                  icon={<SettingsIcon size={16} />}
                  onClick={settingsModal.onOpen}
                  variant="outline"
                  borderColor="gray.500"
                  colorScheme="gray"
                  size="sm"
                  w="36px"
                  h="36px"
                  borderRadius="sm"
                />
              </Tooltip>
            </Flex>

            {/* WorkShiftInfographic - Full Width Below */}
            <WorkShiftInfographic onEditTask={handleOpenEditModal} onAddCustomTask={handleOpenAddCustomTaskModal} />
          </Flex>
        )}
      </Box>

      {/* Edit Task Modal */}
      <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} size="md" isCentered scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent bg="gray.800" maxW="500px" maxH="90vh">
          <ModalHeader>Edit Task</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Flex gap={4}>
              <Box flex={1}>
                <FormControl>
                  <FormLabel fontSize="sm">Task Name</FormLabel>
                  <Box position="relative">
                    <Input
                      ref={editTaskInputRef}
                      value={editingTaskName}
                      onChange={async (e) => {
                        const value = e.target.value;
                        setEditingTaskName(value);
                        if (value.length > 0) {
                          setShowPresetDropdown(true);
                          await loadPresetTasks();
                        } else {
                          setShowPresetDropdown(false);
                        }
                      }}
                      onFocus={async () => {
                        if (editingTaskName.length > 0) {
                          setShowPresetDropdown(true);
                          await loadPresetTasks();
                        }
                      }}
                      placeholder="Task..."
                      bg="gray.700"
                    />
                    {showPresetDropdown && presetTaskOptions.length > 0 && (
                      <Box
                        ref={editTaskDropdownRef}
                        position="absolute"
                        top="100%"
                        left="0"
                        right="0"
                        mt={1}
                        bg="gray.800"
                        border="1px solid"
                        borderColor="gray.600"
                        borderRadius="md"
                        boxShadow="lg"
                        maxH="200px"
                        overflowY="auto"
                        zIndex={20}
                      >
                        <VStack spacing={0} align="stretch" p={1}>
                          {presetTaskOptions.slice(0, 5).map((option, idx) => (
                            <Box
                              key={`${option}-${idx}`}
                              px={3}
                              py={2}
                              cursor="pointer"
                              _hover={{ bg: 'gray.700' }}
                              onClick={() => {
                                setEditingTaskName(option);
                                setShowPresetDropdown(false);
                              }}
                              borderBottom={idx < Math.min(4, presetTaskOptions.length - 1) ? '1px solid' : 'none'}
                              borderColor="gray.600"
                            >
                              <Flex align="center" gap={2}>
                                <Text fontSize="sm">{option}</Text>
                                {NON_BILLABLE_TASKS.includes(option) && (
                                  <Badge colorScheme="orange" fontSize="xs">
                                    Internal
                                  </Badge>
                                )}
                              </Flex>
                            </Box>
                          ))}
                        </VStack>
                      </Box>
                    )}
                  </Box>
                </FormControl>
              </Box>
              <Box flex={1}>
                <FormControl>
                  <FormLabel fontSize="sm">Duration (HH:MM:SS)</FormLabel>
                  <Input
                    value={editingTaskDuration}
                    onChange={(e) => setEditingTaskDuration(formatDurationInput(e.target.value))}
                    placeholder="013000"
                    bg="gray.700"
                    maxLength={8}
                  />
                </FormControl>
              </Box>
            </Flex>
            <FormControl mt={4}>
              <FormLabel fontSize="sm">Narration</FormLabel>
              <Textarea value={editingTaskNarration} onChange={(e) => setEditingTaskNarration(e.target.value)} bg="gray.700" />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <IconButton aria-label="Delete task" icon={<Trash2 size={16} />} mr="auto" variant="ghost" colorScheme="red" onClick={handleDeleteTask} />
            <Button variant="ghost" mr={3} onClick={editModal.onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSaveEdit} isDisabled={!editingTaskName.trim() || !editingTaskDuration.trim()}>
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Custom Task Modal */}
      <Modal isOpen={addCustomModal.isOpen} onClose={addCustomModal.onClose} size="md" isCentered scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent bg="gray.800" maxW="600px" maxH="90vh">
          <ModalHeader>Add Custom Task</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Flex gap={4}>
              <Box flex={1}>
                <FormControl>
                  <FormLabel fontSize="sm">Task Name</FormLabel>
                  <Box position="relative">
                    <Input
                      ref={customTaskInputRef}
                      value={customTaskName}
                      onChange={async (e) => {
                        const value = e.target.value;
                        setCustomTaskName(value);
                        if (value.length > 0) {
                          setShowCustomTaskPresetDropdown(true);
                          await loadCustomTaskPresetTasks();
                        } else {
                          setShowCustomTaskPresetDropdown(false);
                        }
                      }}
                      onFocus={async () => {
                        await loadCustomTaskPresetTasks();
                        setShowCustomTaskPresetDropdown(true);
                      }}
                      placeholder="Task..."
                      bg="gray.700"
                    />
                    {showCustomTaskPresetDropdown && customTaskPresetOptions.length > 0 && (
                      <Box
                        ref={customTaskDropdownRef}
                        position="absolute"
                        top="100%"
                        left="0"
                        right="0"
                        mt={1}
                        bg="gray.800"
                        border="1px solid"
                        borderColor="gray.600"
                        borderRadius="md"
                        boxShadow="lg"
                        maxH="200px"
                        overflowY="auto"
                        zIndex={20}
                      >
                        <VStack spacing={0} align="stretch" p={1}>
                          {customTaskPresetOptions.slice(0, 5).map((option, idx) => (
                            <Box
                              key={`${option}-${idx}`}
                              px={3}
                              py={2}
                              cursor="pointer"
                              _hover={{ bg: 'gray.700' }}
                              onClick={() => {
                                setCustomTaskName(option);
                                setShowCustomTaskPresetDropdown(false);
                              }}
                              borderBottom={idx < Math.min(4, customTaskPresetOptions.length - 1) ? '1px solid' : 'none'}
                              borderColor="gray.600"
                            >
                              <Flex align="center" gap={2}>
                                <Text fontSize="sm">{option}</Text>
                                {NON_BILLABLE_TASKS.includes(option) && (
                                  <Badge colorScheme="orange" fontSize="xs">
                                    Internal
                                  </Badge>
                                )}
                              </Flex>
                            </Box>
                          ))}
                        </VStack>
                      </Box>
                    )}
                  </Box>
                </FormControl>
                <FormControl mt={4}>
                  <FormLabel fontSize="sm">Duration (HH:MM:SS)</FormLabel>
                  <Input
                    value={customTaskDuration}
                    onChange={(e) => setCustomTaskDuration(formatDurationInput(e.target.value))}
                    placeholder="013000"
                    bg="gray.700"
                    maxLength={8}
                  />
                </FormControl>
              </Box>
              <Box flex={1}>
                <FormControl>
                  <FormLabel fontSize="sm">Narration (Optional)</FormLabel>
                  <Textarea value={customTaskNarration} onChange={(e) => setCustomTaskNarration(e.target.value)} bg="gray.700" rows={6} />
                </FormControl>
              </Box>
            </Flex>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={addCustomModal.onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleSaveCustomTask} isDisabled={!customTaskName.trim() || !customTaskDuration.trim()}>
              Add Task
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Stop Timer Modal */}
      <Modal isOpen={stopTimerModal.isOpen} onClose={stopTimerModal.onClose} size="md" isCentered scrollBehavior="inside">
        <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
        <ModalContent bg="gray.800" maxW="600px" maxH="90vh">
          <ModalHeader>Confirm Task</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Flex gap={4}>
              <Box flex={1}>
                <FormControl>
                  <FormLabel fontSize="sm">Task Name</FormLabel>
                  <Box position="relative">
                    <Input
                      ref={stopTimerInputRef}
                      value={stopTimerTaskName}
                      onChange={async (e) => {
                        const value = e.target.value;
                        setStopTimerTaskName(value);
                        if (value.length > 0) {
                          setShowStopTimerPresetDropdown(true);
                          await loadStopTimerPresetTasks();
                        } else {
                          setShowStopTimerPresetDropdown(false);
                        }
                      }}
                      onFocus={async () => {
                        await loadStopTimerPresetTasks();
                        setShowStopTimerPresetDropdown(true);
                      }}
                      placeholder="Task..."
                      bg="gray.700"
                    />
                    {showStopTimerPresetDropdown && stopTimerPresetOptions.length > 0 && (
                      <Box
                        ref={stopTimerDropdownRef}
                        position="absolute"
                        top="100%"
                        left="0"
                        right="0"
                        mt={1}
                        bg="gray.800"
                        border="1px solid"
                        borderColor="gray.600"
                        borderRadius="md"
                        boxShadow="lg"
                        maxH="200px"
                        overflowY="auto"
                        zIndex={20}
                      >
                        <VStack spacing={0} align="stretch" p={1}>
                          {stopTimerPresetOptions.slice(0, 5).map((option, idx) => (
                            <Box
                              key={`${option}-${idx}`}
                              px={3}
                              py={2}
                              cursor="pointer"
                              _hover={{ bg: 'gray.700' }}
                              onClick={() => {
                                setStopTimerTaskName(option);
                                setShowStopTimerPresetDropdown(false);
                              }}
                              borderBottom={idx < Math.min(4, stopTimerPresetOptions.length - 1) ? '1px solid' : 'none'}
                              borderColor="gray.600"
                            >
                              <Flex align="center" gap={2}>
                                <Text fontSize="sm">{option}</Text>
                                {NON_BILLABLE_TASKS.includes(option) && (
                                  <Badge colorScheme="orange" fontSize="xs">
                                    Internal
                                  </Badge>
                                )}
                              </Flex>
                            </Box>
                          ))}
                        </VStack>
                      </Box>
                    )}
                  </Box>
                </FormControl>
                <FormControl mt={4}>
                  <FormLabel fontSize="sm">Duration (HH:MM:SS)</FormLabel>
                  <Input
                    value={stopTimerDuration}
                    onChange={(e) => setStopTimerDuration(formatDurationInput(e.target.value))}
                    placeholder="013000"
                    bg="gray.700"
                    maxLength={8}
                  />
                </FormControl>
              </Box>
              <Box flex={1}>
                <FormControl>
                  <FormLabel fontSize="sm">Narration (Optional)</FormLabel>
                  <Textarea value={stopTimerNarration} onChange={(e) => setStopTimerNarration(e.target.value)} bg="gray.700" rows={6} />
                </FormControl>
              </Box>
            </Flex>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={stopTimerModal.onClose}>
              Cancel
            </Button>
            <Button colorScheme="blue" onClick={handleConfirmStopTimer} isDisabled={!stopTimerTaskName.trim() || !stopTimerDuration.trim()}>
              Save
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default TimeLoggerWindow;


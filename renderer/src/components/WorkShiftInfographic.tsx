import React, { useEffect, useState, useMemo } from 'react';
import {
  Badge,
  Box,
  Flex,
  IconButton,
  Text,
  useColorModeValue,
  VStack,
  Tooltip,
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverArrow,
  PopoverBody,
  Portal
} from '@chakra-ui/react';
import { Plus } from 'lucide-react';
import { settingsService } from '../services/settings';

interface WorkShiftInfographicProps {
  onEditTask?: (taskId: string) => Promise<void>;
  onAddCustomTask?: () => void;
}

const NON_BILLABLE_TASKS = [
  'Internal - Meetings',
  'Internal - IT Issues',
  'Internal - Workflow Planning'
];

const WorkShiftInfographic: React.FC<WorkShiftInfographicProps> = ({ onEditTask, onAddCustomTask }) => {
  const [workShiftStart, setWorkShiftStart] = useState('06:00');
  const [workShiftEnd, setWorkShiftEnd] = useState('15:00');
  const [productivityTarget, setProductivityTarget] = useState(27000);
  const [todayTimeWorked, setTodayTimeWorked] = useState(0);
  const [billableTimeWorked, setBillableTimeWorked] = useState(0);
  const [currentTimeInShift, setCurrentTimeInShift] = useState(0);
  const [shiftProgress, setShiftProgress] = useState(0);
  const [loggedTimeProgress, setLoggedTimeProgress] = useState(0);
  const [currentTimePosition, setCurrentTimePosition] = useState(0);
  const [currentTimeGMT8, setCurrentTimeGMT8] = useState('');
  const [timeDifference, setTimeDifference] = useState(0);
  const [tasks, setTasks] = useState<any[]>([]);
  const [shiftDurationSeconds, setShiftDurationSeconds] = useState(0);

  const popoverBg = useColorModeValue('white', 'gray.800');
  const popoverBorderColor = useColorModeValue('#e2e8f0', 'gray.600');

  const isNonBillableTask = (taskName?: string) =>
    NON_BILLABLE_TASKS.some(nbTask => taskName?.toLowerCase().includes(nbTask.toLowerCase()));

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await settingsService.getSettings();
        if (settings.workShiftStart) setWorkShiftStart(settings.workShiftStart);
        if (settings.workShiftEnd) setWorkShiftEnd(settings.workShiftEnd);
        if (settings.productivityTargetHours) {
          setProductivityTarget(Math.round(settings.productivityTargetHours * 3600));
        }
      } catch (error) {
        console.error('Error loading work shift settings', error);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const GMT_8_OFFSET_MS = 8 * 60 * 60 * 1000;
    const calculateTodayTime = async () => {
      try {
        const now = new Date();
        const gmt8Time = new Date(now.getTime() + GMT_8_OFFSET_MS);
        const today = gmt8Time.toISOString().split('T')[0];
        const result = await (window.electronAPI as any)?.getTaskLogs?.(today);
        if (result?.success && Array.isArray(result.tasks)) {
          let totalSeconds = 0;
          let billableSeconds = 0;
          const processed = result.tasks.map((task: any) => {
            const duration = task.duration || 0;
            totalSeconds += duration;
            if (!isNonBillableTask(task.name)) {
              billableSeconds += duration;
            }
            return { ...task, duration, isBillable: !isNonBillableTask(task.name) };
          });
          setTasks(processed);
          setTodayTimeWorked(totalSeconds);
          setBillableTimeWorked(billableSeconds);
          const [startHour, startMin] = workShiftStart.split(':').map(Number);
          const [endHour, endMin] = workShiftEnd.split(':').map(Number);
          const startMinutes = startHour * 60 + startMin;
          const endMinutes = endHour * 60 + endMin;
          const shiftDuration = (endMinutes - startMinutes) * 60;
          setShiftDurationSeconds(shiftDuration);
          const loggedProgress = shiftDuration > 0 ? Math.min(100, (totalSeconds / shiftDuration) * 100) : 0;
          setLoggedTimeProgress(loggedProgress);
        }
      } catch (error) {
        console.error('Error calculating today time', error);
      }
    };

    const calculateShiftProgress = () => {
      const now = new Date();
      const gmt8TimeString = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Manila'
      });
      setCurrentTimeGMT8(gmt8TimeString);
      const [hour, minute] = gmt8TimeString.split(':').map(Number);
      const currentMinutes = hour * 60 + minute;
      const [startHour, startMin] = workShiftStart.split(':').map(Number);
      const [endHour, endMin] = workShiftEnd.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const shiftDurationMinutes = endMinutes - startMinutes;
      const elapsedMinutes = currentMinutes - startMinutes;
      let position = 0;
      if (currentMinutes < startMinutes) {
        setCurrentTimeInShift(0);
        setShiftProgress(0);
        position = 0;
      } else if (currentMinutes > endMinutes) {
        setCurrentTimeInShift(shiftDurationMinutes * 60);
        setShiftProgress(100);
        position = 100;
      } else {
        setCurrentTimeInShift(elapsedMinutes * 60);
        setShiftProgress((elapsedMinutes / shiftDurationMinutes) * 100);
        position = (elapsedMinutes / shiftDurationMinutes) * 100;
      }
      setCurrentTimePosition(position);
    };

    calculateTodayTime();
    calculateShiftProgress();
    const interval = setInterval(() => {
      calculateTodayTime();
      calculateShiftProgress();
    }, 60000);

    const handleTaskUpdate = () => calculateTodayTime();
    window.addEventListener('task-updated', handleTaskUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('task-updated', handleTaskUpdate);
    };
  }, [workShiftStart, workShiftEnd, productivityTarget]);

  useEffect(() => {
    setTimeDifference(todayTimeWorked - currentTimeInShift);
  }, [todayTimeWorked, currentTimeInShift]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const formatTimeDifference = (seconds: number) => {
    const abs = Math.abs(seconds);
    const hours = Math.floor(abs / 3600);
    const minutes = Math.floor((abs % 3600) / 60);
    const sign = seconds >= 0 ? '+' : '-';
    return `${sign}${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const productivityPercentage = todayTimeWorked > 0 ? (billableTimeWorked / todayTimeWorked) * 100 : 0;

  const taskSegments = useMemo(() => {
    if (shiftDurationSeconds === 0 || tasks.length === 0) return [];
    const totalDuration = tasks.reduce((sum, task) => sum + (task.duration || 0), 0);
    if (totalDuration === 0) return [];
    const sorted = [...tasks].sort((a, b) => {
      const aBillable = !isNonBillableTask(a.name);
      const bBillable = !isNonBillableTask(b.name);
      if (aBillable && !bBillable) return -1;
      if (!aBillable && bBillable) return 1;
      return 0;
    });
    let cumulativeLeft = 0;
    const gapPercent = 0.5;
    return sorted.map((task, idx) => {
      const segmentWidth = (task.duration / shiftDurationSeconds) * 100;
      const left = cumulativeLeft;
      cumulativeLeft += segmentWidth + (idx < sorted.length - 1 ? gapPercent : 0);
      return {
        ...task,
        left: Math.min(100, left),
        width: Math.min(100 - left, segmentWidth)
      };
    });
  }, [shiftDurationSeconds, tasks]);

  return (
    <Flex direction="column" w="320px" px={3} py={3} bg="gray.800" borderLeft="1px solid" borderColor="whiteAlpha.100" gap={3}>
      <Flex align="center" justify="space-between" gap={2}>
        <Flex align="center" gap={2}>
          <Badge
            px={3}
            py={1}
            borderRadius="sm"
            bg="green.500"
            color="white"
            fontSize="13px"
            fontWeight="700"
            letterSpacing="0.05em"
            boxShadow="0 2px 8px rgba(72, 187, 120, 0.4)"
          >
            {currentTimeGMT8}
          </Badge>
          <Tooltip label="Add custom task">
            <IconButton
              aria-label="Add custom task"
              icon={<Plus size={12} />}
              size="xs"
              variant="ghost"
              colorScheme="green"
              border="1px solid"
              borderColor="green.400"
              borderRadius={3}
              _hover={{ bg: 'green.500', color: 'white', borderColor: 'green.500' }}
              onClick={onAddCustomTask}
            />
          </Tooltip>
        </Flex>
        <Box bg={timeDifference >= 0 ? 'blue.500' : 'gray.500'} borderRadius="sm" px={3} py={1}>
          <Text fontSize="12px" color="whiteAlpha.900" fontWeight="600" fontFamily="mono">
            {timeDifference >= 0 ? 'Ahead' : 'Behind'} {formatTimeDifference(timeDifference)}
          </Text>
        </Box>
      </Flex>

      {/* Shift progress */}
      <Box>
        <Box mb={2}>
          <Flex justify="space-between" mb={1}>
            <Text fontSize="10px" color="gray.500" fontWeight="500">
              Shift Time
            </Text>
            <Text fontSize="10px" color={shiftProgress > 100 ? 'red.400' : 'cyan.400'} fontWeight="600">
              {formatTime(currentTimeInShift)}
            </Text>
          </Flex>
          <Box position="relative" h="24px" bg="whiteAlpha.100" borderRadius="sm" overflow="visible">
            <Box
              position="absolute"
              left="0"
              top="0"
              h="100%"
              w={`${Math.min(100, Math.max(0, shiftProgress))}%`}
              bg={shiftProgress > 100 ? 'red.500' : 'cyan.500'}
              transition="width 0.3s ease"
              borderRadius="sm"
            />
            {shiftProgress > 100 && (
              <Box
                position="absolute"
                left="100%"
                top="0"
                h="100%"
                w={`${Math.min(100, shiftProgress - 100)}%`}
                bg="red.600"
                borderRadius="0 sm sm 0"
                borderLeft="2px solid"
                borderColor="red.400"
              />
            )}
            {currentTimePosition > 0 && (
              <Box
                position="absolute"
                left={`${Math.min(100, currentTimePosition)}%`}
                top="-4px"
                w="2px"
                h="32px"
                bg={currentTimePosition > 100 ? 'red.400' : 'green.400'}
                borderRadius="full"
                zIndex={10}
                transform="translateX(-50%)"
              />
            )}
            <Flex position="absolute" left="0" top="0" w="100%" h="100%" align="center" justify="center" zIndex={2} pointerEvents="none">
              <Text fontSize="10px" fontWeight="700" color="white">
                {shiftProgress.toFixed(0)}%
              </Text>
            </Flex>
          </Box>
        </Box>

        {/* Logged time bar */}
        <Box mb={2}>
          <Flex justify="space-between" mb={1}>
            <Text fontSize="10px" color="gray.500" fontWeight="500">
              Logged Time
            </Text>
            <Text fontSize="10px" color="blue.400" fontWeight="600">
              {formatTime(todayTimeWorked)}
            </Text>
          </Flex>
          <Box position="relative" h="24px" bg="whiteAlpha.100" borderRadius="sm" overflow="visible">
            <Box position="absolute" left="85%" top="0" bottom="0" w="1px" bg="green.400" opacity={0.5} zIndex={10} pointerEvents="none" />
            <Box position="relative" h="100%" overflow="hidden" borderRadius="sm">
              {taskSegments.map((segment, idx) => {
                const segmentEnd = segment.left + segment.width;
                const segmentName = segment.name || `Task ${idx + 1}`;
                const segmentDuration = formatTime(segment.duration);
                const width = segmentEnd > loggedTimeProgress ? Math.max(0, loggedTimeProgress - segment.left) : segment.width;
                if (width <= 0) return null;
                return (
                  <Box
                    key={`${segment.id}-${idx}`}
                    position="absolute"
                    left={`${segment.left}%`}
                    top="0"
                    h="100%"
                    w={`${width}%`}
                    cursor={segment.id ? 'pointer' : 'default'}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (segment.id && onEditTask) {
                        await onEditTask(segment.id);
                      }
                    }}
                    style={{
                      marginRight: idx < taskSegments.length - 1 ? '2px' : '0'
                    }}
                  >
                    <Popover placement="bottom" trigger="hover" openDelay={200} closeOnBlur>
                      <PopoverTrigger>
                        <Box
                          w="100%"
                          h="100%"
                          bg={segment.isBillable ? 'blue.500' : 'orange.500'}
                          borderRadius={
                            segment.left === 0
                              ? 'sm 0 0 sm'
                              : idx === taskSegments.length - 1
                                ? '0 sm sm 0'
                                : '0'
                          }
                          _hover={{ opacity: 0.9 }}
                        />
                      </PopoverTrigger>
                      <Portal>
                        <PopoverContent bg={popoverBg} border="1px solid" borderColor={popoverBorderColor} boxShadow="lg" maxW="250px" zIndex={9999}>
                          <PopoverArrow bg={popoverBg} borderColor={popoverBorderColor} />
                          <PopoverBody p={3}>
                            <VStack align="stretch" spacing={2}>
                              <Text fontSize="sm" fontWeight="semibold">
                                {segmentName}
                              </Text>
                              <Flex align="center" gap={2}>
                                <Text fontSize="xs" color="gray.500">
                                  Duration:
                                </Text>
                                <Text fontSize="xs" fontWeight="medium">
                                  {segmentDuration}
                                </Text>
                              </Flex>
                              {segment.narration && (
                                <Box>
                                  <Text fontSize="xs" color="gray.500" mb={1}>
                                    Narration:
                                  </Text>
                                  <Text fontSize="xs" fontStyle="italic">
                                    {segment.narration}
                                  </Text>
                                </Box>
                              )}
                              {segment.isBillable === false && (
                                <Badge colorScheme="orange" fontSize="xs" width="fit-content">
                                  Non-Billable
                                </Badge>
                              )}
                            </VStack>
                          </PopoverBody>
                        </PopoverContent>
                      </Portal>
                    </Popover>
                  </Box>
                );
              })}
              {loggedTimeProgress > 0 && (
                <Flex position="absolute" left="0" top="0" w="100%" h="100%" align="center" justify="center" zIndex={2} pointerEvents="none">
                  <Text fontSize="10px" fontWeight="700" color="white">
                    {loggedTimeProgress.toFixed(0)}%
                  </Text>
                </Flex>
              )}
            </Box>
          </Box>
        </Box>

        <Box mt={3}>
          <Flex align="center" gap={2} mb={2}>
            <Text fontSize="11px" fontWeight="600" color="gray.300" textTransform="uppercase" letterSpacing="0.05em">
              Today&apos;s Summary
            </Text>
          </Flex>
          <VStack spacing={2} align="stretch">
            <Flex justify="space-between" align="center">
              <Text fontSize="10px" color="gray.500" fontWeight="500">
                Total Time
              </Text>
              <Text fontSize="11px" color="white" fontWeight="600">
                {formatTime(todayTimeWorked)}
              </Text>
            </Flex>
            <Flex justify="space-between" align="center">
              <Text fontSize="10px" color="gray.500" fontWeight="500">
                Billable Time
              </Text>
              <Text fontSize="11px" color="blue.400" fontWeight="600">
                {formatTime(billableTimeWorked)}
              </Text>
            </Flex>
            {productivityPercentage > 0 && (
              <Flex justify="space-between" align="center" pt={1} borderTop="1px solid" borderColor="whiteAlpha.100">
                <Text fontSize="10px" color="gray.500" fontWeight="500">
                  Productivity
                </Text>
                <Text
                  fontSize="11px"
                  color={productivityPercentage >= 85 ? 'green.400' : productivityPercentage >= 70 ? 'yellow.400' : 'orange.400'}
                  fontWeight="600"
                >
                  {productivityPercentage.toFixed(0)}%
                </Text>
              </Flex>
            )}
          </VStack>
        </Box>
      </Box>
    </Flex>
  );
};

export default WorkShiftInfographic;


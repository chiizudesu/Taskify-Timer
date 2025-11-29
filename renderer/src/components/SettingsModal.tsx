import React, { useEffect, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  FormControl,
  FormLabel,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  Switch,
  Text,
  useToast,
  VStack
} from '@chakra-ui/react';
import { settingsService, TimeLoggerSettings } from '../services/settings';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSaved }) => {
  const toast = useToast();
  const [settings, setSettings] = useState<TimeLoggerSettings>({ rootPath: '' });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await settingsService.getSettings();
        setSettings({
          rootPath: data.rootPath || '',
          clientbasePath: data.clientbasePath,
          workShiftStart: data.workShiftStart || '06:00',
          workShiftEnd: data.workShiftEnd || '15:00',
          productivityTargetHours: data.productivityTargetHours ?? 7.5,
          trackWindows: data.trackWindows ?? true,
          windowTrackingInterval: data.windowTrackingInterval ?? 2
        });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [isOpen]);

  const updateSetting = <K extends keyof TimeLoggerSettings>(key: K, value: TimeLoggerSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleBrowseCsv = async () => {
    const api = (window as any).electronAPI;
    if (!api?.selectFile) return;
    const path = await api.selectFile({
      title: 'Select Clientbase CSV File',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    });
    if (path) {
      updateSetting('clientbasePath', path);
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      await settingsService.setSettings(settings);
      toast({ title: 'Settings saved', status: 'success', duration: 2000, isClosable: true });
      onSaved?.();
      onClose();
    } catch (error) {
      console.error('Failed to save settings', error);
      toast({ title: 'Failed to save settings', status: 'error', duration: 3000, isClosable: true });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" isCentered>
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />
      <ModalContent bg="gray.900" border="1px solid" borderColor="whiteAlpha.200">
        <ModalHeader>Time Logger Settings</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <FormControl>
              <FormLabel fontSize="sm">Clientbase CSV</FormLabel>
              <HStack>
                <Input
                  value={settings.clientbasePath || ''}
                  onChange={e => updateSetting('clientbasePath', e.target.value)}
                  placeholder="Path to client CSV..."
                  bg="gray.800"
                  borderColor="whiteAlpha.200"
                  fontSize="sm"
                />
                <Button size="sm" onClick={handleBrowseCsv}>
                  Browse
                </Button>
              </HStack>
              <Text fontSize="xs" color="gray.500" mt={1}>
                Used to populate task search results.
              </Text>
            </FormControl>

            <HStack spacing={4} align="flex-start">
              <FormControl>
                <FormLabel fontSize="sm">Shift Start</FormLabel>
                <Input
                  type="time"
                  value={settings.workShiftStart || '06:00'}
                  onChange={e => updateSetting('workShiftStart', e.target.value)}
                  bg="gray.800"
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="sm">Shift End</FormLabel>
                <Input
                  type="time"
                  value={settings.workShiftEnd || '15:00'}
                  onChange={e => updateSetting('workShiftEnd', e.target.value)}
                  bg="gray.800"
                />
              </FormControl>
            </HStack>

            <FormControl>
              <FormLabel fontSize="sm">Productivity Target (hours)</FormLabel>
              <NumberInput
                step={0.5}
                min={0}
                max={24}
                value={settings.productivityTargetHours ?? 7.5}
                onChange={(_, value) => updateSetting('productivityTargetHours', Number.isNaN(value) ? 0 : value)}
              >
                <NumberInputField bg="gray.800" />
              </NumberInput>
            </FormControl>

            <Box border="1px solid" borderColor="whiteAlpha.200" borderRadius="md" p={3}>
              <HStack justify="space-between">
                <VStack align="flex-start" spacing={1}>
                  <Text fontSize="sm" fontWeight="600">
                    Active Window Tracking
                  </Text>
                  <Text fontSize="xs" color="gray.400">
                    Stores foreground window titles while a task runs.
                  </Text>
                </VStack>
                <Switch
                  isChecked={settings.trackWindows ?? true}
                  onChange={e => updateSetting('trackWindows', e.target.checked)}
                  colorScheme="blue"
                />
              </HStack>
              <FormControl mt={3} isDisabled={settings.trackWindows === false}>
                <FormLabel fontSize="xs" color="gray.400">
                  Tracking Interval (seconds)
                </FormLabel>
                <NumberInput
                  min={1}
                  max={10}
                  value={settings.windowTrackingInterval ?? 2}
                  onChange={(_, value) => updateSetting('windowTrackingInterval', Number.isNaN(value) ? 2 : value)}
                >
                  <NumberInputField bg="gray.800" />
                </NumberInput>
              </FormControl>
            </Box>

            <Badge colorScheme="purple" alignSelf="flex-start">
              Settings persist to: userData/time-logger-config.json
            </Badge>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSave} isLoading={isLoading}>
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default SettingsModal;


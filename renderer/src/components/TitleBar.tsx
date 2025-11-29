import React from 'react';
import { Box, Flex, IconButton, Text } from '@chakra-ui/react';
import { Minus, Square, X } from 'lucide-react';

const TitleBar = () => {
  const handleMinimize = () => {
    (window.electronAPI as any)?.windowMinimize?.();
  };

  const handleMaximize = () => {
    (window.electronAPI as any)?.windowMaximize?.();
  };

  const handleClose = () => {
    (window.electronAPI as any)?.windowClose?.();
  };

  return (
    <Flex
      h="32px"
      bg="gray.800"
      align="center"
      justify="space-between"
      px={2}
      borderBottom="1px solid"
      borderColor="whiteAlpha.200"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <Flex align="center" gap={2} px={2}>
        <Text fontSize="xs" fontWeight="semibold" color="gray.300">
          Time Logger
        </Text>
      </Flex>
      <Flex style={{ WebkitAppRegion: 'no-drag' } as any}>
        <IconButton
          aria-label="Minimize"
          icon={<Minus size={12} />}
          size="xs"
          variant="ghost"
          onClick={handleMinimize}
          color="gray.400"
          _hover={{ bg: 'whiteAlpha.200', color: 'white' }}
          borderRadius={0}
          h="32px"
          w="46px"
        />
        <IconButton
          aria-label="Maximize"
          icon={<Square size={10} />}
          size="xs"
          variant="ghost"
          onClick={handleMaximize}
          color="gray.400"
          _hover={{ bg: 'whiteAlpha.200', color: 'white' }}
          borderRadius={0}
          h="32px"
          w="46px"
        />
        <IconButton
          aria-label="Close"
          icon={<X size={12} />}
          size="xs"
          variant="ghost"
          onClick={handleClose}
          color="gray.400"
          _hover={{ bg: 'red.500', color: 'white' }}
          borderRadius={0}
          h="32px"
          w="46px"
        />
      </Flex>
    </Flex>
  );
};

export default TitleBar;


import React from 'react';
import { Box, Flex, IconButton, Text, Tooltip } from '@chakra-ui/react';
import { LayoutGrid, LayoutList, X } from 'lucide-react';
import { useLayout } from '../contexts/LayoutContext';

const TitleBar = () => {
  const { layout, setLayout } = useLayout();

  const handleClose = () => {
    (window.electronAPI as any)?.windowClose?.();
  };

  const handleHorizontalLayout = () => {
    setLayout('horizontal');
  };

  const handleVerticalLayout = () => {
    setLayout('vertical');
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
        <Tooltip label="Switch to horizontal layout" placement="bottom">
          <IconButton
            aria-label="Horizontal layout"
            icon={<LayoutGrid size={12} />}
            size="xs"
            variant="ghost"
            onClick={handleHorizontalLayout}
            color={layout === 'horizontal' ? 'blue.400' : 'gray.400'}
            bg={layout === 'horizontal' ? 'whiteAlpha.100' : 'transparent'}
            _hover={{ bg: 'whiteAlpha.200', color: 'white' }}
            borderRadius={0}
            h="32px"
            w="46px"
          />
        </Tooltip>
        <Tooltip label="Switch to vertical layout" placement="bottom">
          <IconButton
            aria-label="Vertical layout"
            icon={<LayoutList size={12} />}
            size="xs"
            variant="ghost"
            onClick={handleVerticalLayout}
            color={layout === 'vertical' ? 'blue.400' : 'gray.400'}
            bg={layout === 'vertical' ? 'whiteAlpha.100' : 'transparent'}
            _hover={{ bg: 'whiteAlpha.200', color: 'white' }}
            borderRadius={0}
            h="32px"
            w="46px"
          />
        </Tooltip>
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


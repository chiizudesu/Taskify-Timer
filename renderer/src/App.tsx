import { Box } from '@chakra-ui/react';
import TimeLoggerWindow from './components/TimeLoggerWindow';
import { LayoutProvider } from './contexts/LayoutContext';

const App = () => {
  return (
    <LayoutProvider>
      <Box w="100vw" h="100vh" bg="gray.900">
        <TimeLoggerWindow />
      </Box>
    </LayoutProvider>
  );
};

export default App;


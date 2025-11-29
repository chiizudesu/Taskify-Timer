import { Box } from '@chakra-ui/react';
import TimeLoggerWindow from './components/TimeLoggerWindow';

const App = () => {
  return (
    <Box w="100vw" h="100vh" bg="gray.900">
      <TimeLoggerWindow />
    </Box>
  );
};

export default App;


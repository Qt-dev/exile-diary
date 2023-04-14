import { useState } from 'react';
import logo from './logo.svg';
import './App.css';
import SideNav from './components/SideNav/SideNav';

const version = '1.0.0-DEV';
const isNewVersion = true;

function App() {
  const [isNewVersion, setIsNewVersion] = useState(true); // Change this to make it save
  const turnNewVersionOff = () => {
    setIsNewVersion(false);
  };
  return (
    <div className="App">
      <div className="App__Left-Column">
        <SideNav
          version={version}
          isNewVersion={isNewVersion}
          turnNewVersionOff={turnNewVersionOff}
        />
      </div>
      {/* <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header> */}
    </div>
  );
}

export default App;

import React from 'react';
import './App.css';
import 'antd/dist/antd.css';

import TokenSupply from "./view/TokenSupply";
import Title from "antd/lib/typography/Title";

function App() {
  return (
    <div className="App">
        <Title level={1}>Cross chain tokens</Title>
        <TokenSupply/>
        <Title level={1}>-</Title>
    </div>
  );
}

export default App;

import React from 'react';
import './App.css';
import 'antd/dist/antd.css';

import TokenSupply from "./view/TokenSupply";
import Title from "antd/lib/typography/Title";

function App() {
  return (
    <div className="App">
        <Title key={'t1'} level={1} style={{paddingTop: '1em'}}>Cross chain tokens</Title>
        <div style={{paddingLeft: '10%', paddingRight: '10%'}}>
            <TokenSupply/>
        </div>
        <Title key={'t2'} level={1}>-</Title>
    </div>
  );
}

export default App;

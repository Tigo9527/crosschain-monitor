import React from 'react';
import './App.css';
import 'antd/dist/antd.css';
import { Collapse } from 'antd';

import TokenSupply from "./view/TokenSupply";
import Title from "antd/lib/typography/Title";
import SyncInfo from "./view/SyncInfo";

const { Panel } = Collapse;

function App() {
  return (
    <div className="App">
        <Title key={'t1'} level={1} style={{paddingTop: '1em'}}>Cross chain tokens</Title>
        <div key='divK1' style={{paddingLeft: '10%', paddingRight: '10%'}}>
            <Collapse defaultActiveKey={['1']}>
                <Panel header="Minter supply" key="1">
                    <TokenSupply/>
                </Panel>
                <Panel header="Sync Info" key="2">
                    <SyncInfo/>
                </Panel>
            </Collapse>
        </div>
        <Title key={'t2'} level={1}>-</Title>
    </div>
  );
}

export default App;

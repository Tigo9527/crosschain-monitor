import {Card, Tabs} from "antd";
import TabPane = Tabs.TabPane;
import {SwapMain} from "./swapMain";
import {Erc20main} from "./erc20main";
import {useEffect, useState} from "react";

export const SwapIndex = () => {
	const [ak, setAk] = useState(localStorage.getItem("swapIndex") || 't1')
	useEffect(()=>{
	}, [])
	return (
		<Tabs defaultActiveKey={ak} style={{margin: '24px'}} onChange={(ak)=>{
			localStorage.setItem('swapIndex', ak)
			setAk(ak)
		}}>
			<TabPane tab={'Pairs'} key={'t1'} style={{padding: '0px'}}>
				<SwapMain/>
			</TabPane>
			<TabPane tab={'Tokens'} key={'t2'}>
				<Erc20main/>
			</TabPane>
		</Tabs>
	);
}

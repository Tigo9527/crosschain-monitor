import {PoolTable} from "./poolTable";
import {useEffect, useState} from "react";
import {Spin} from "antd";
import {defiApiUrl, getHost} from "../common/Util";

export const PoolMain=()=>{
	const [data, setData] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	useEffect(() => {
		setLoading(true);
		const fn = async() => {
			const response = await fetch(`${defiApiUrl}/defi/api/pos/list`);
			const result = await response.json();
			setData(result.data.checkerList);
		}
		fn().finally(() => setLoading(false));
	}, [])

	if (loading) {
		return <Spin size="large" style={{ display: 'block', margin: '50px auto' }} />;
	}

    return (
        <>
	        <div style={{ padding: '24px' }}>
		        <h1>PoS Pool Dashboard</h1>
		        <PoolTable data={data} loading={loading} />
	        </div>
        </>
    )
}

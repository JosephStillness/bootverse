import {connection} from 'next/server';
import {notFound} from 'next/navigation';
import {getProduct} from '@/lib/boots/service';
// Resolve visibility before the child's loading boundary commits an HTTP 200 stream.
export default async function ProductLayout({params,children}:{params:Promise<{slug:string}>;children:React.ReactNode}){
 await connection();
 if(!await getProduct((await params).slug))notFound();
 return children;
}

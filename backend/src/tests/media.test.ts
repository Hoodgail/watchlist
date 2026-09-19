import { describe, expect, it, vi } from 'vitest';
import { app, request } from './helpers.js';
vi.mock('../services/tmdbService.js',()=>({
  searchTMDB: vi.fn(async()=>[{id:42,title:'Fixture movie',release_date:'2020-01-01',poster_path:'/fixture.jpg'}]),
  searchTMDBMulti: vi.fn(async()=>[]),
  getTrendingTMDB: vi.fn(async()=>[]),
  getImageUrl: (path:string)=>`https://image.tmdb.org/t/p/w500${path}`,
  extractYear: ()=>2020,
  isAnime: ()=>false,
}));
describe('catalog HTTP contract',()=>{
  it('rejects an empty search',async()=>{await request(app).get('/api/media/search').expect(400)});
  it('returns a typed TMDB identity from a fixture response',async()=>{
    const response=await request(app).get('/api/media/search?q=fixture&category=movie').expect(200);
    expect(response.body).toEqual([expect.objectContaining({id:'tmdb:movie/42',title:'Fixture movie',type:'MOVIE'})]);
  });
  it('does not accept inherited object keys as providers',async()=>{
    await request(app).get('/api/media/info/constructor/42').expect(400);
  });
  it('returns explicit unavailability for a disabled provider',async()=>{
    await request(app).get('/api/media/sources/himovies/episode?mediaId=show').expect(503);
  });
  it('exposes availability and capabilities without claiming untested providers work',async()=>{
    const response=await request(app).get('/api/media/providers').expect(200);
    const providers=Array.isArray(response.body)?response.body:response.body.providers;
    expect(providers.find((p:{name:string})=>p.name==='himovies')).toMatchObject({enabled:false,isWorking:false});
  });
});

# Radiosity implementation using WebGL 

## What is radiosity 

Radiosity is a rendering technique which considers light as energy and simulates the distribution of energy in a scene, this method  takes all the surfaces as lambrent surfaces and can produce results which are view independent.

This means that once that scene is rendered and stored , even if we move the camera the amount of computation needed will not be much, but this also means it will only work on static scenes. 


## The radiosity equation 

The basic form of the radiosity equation is :-
 
Bi = E i + p i ∑ B j F i j

In Equation, B i is the Radiosity of patch i, E i is the emission of patch i, p i is the reflectivity of patch i, B j is the Radiosity of patch j, and F i j is the form factor between patches i and j. This equation is computed for each patch i.

So the general work flow for computing radiosity is 

Compute the scene into patches 
Compute the form factor 
Solve the equation 
Display the scene


Now there are two ways to do this 

We compute the form factor and solve the equation 
Or we compute the form factor and gather all the light through several pass 

In this implementation we will be seeing the second method 


